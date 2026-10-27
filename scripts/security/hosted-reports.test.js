const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { prepareSession, objectUrl, safeReportUrl, errorCode } = require('../hosted-reports/session')
const { uploadReport } = require('../hosted-reports/report')
const { sanitizeHostedReport } = require('./summary')
const root = path.resolve(__dirname, '../..')
const canary = 'SYNTHETIC_REPORT_DETAIL_NOT_FOR_CONSOLE'
const env = { PLAYWRIGHT_HOSTED_REPORT: 'true', S3_BUCKET: 'hosted-report-fixture', S3_REGION: 'us-east-1', S3_ACCESS_KEY: 'synthetic', S3_SECRET: 'synthetic' }
function fakeClient() {
	const uploads = []
	return { uploads, async send(command) {
		const input = command.input
		const chunks = []
		if (typeof input.Body === 'string') chunks.push(Buffer.from(input.Body))
		else for await (const chunk of input.Body) chunks.push(chunk)
		uploads.push({ ...input, Body: Buffer.concat(chunks) })
		return {}
	} }
}
async function zipContents(buffer) {
	const { yauzl } = require('playwright-core/lib/zipBundle')
	return new Promise((resolve, reject) => {
		yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
			if (error) return reject(error)
			const entries = {}
			zip.on('error', reject).on('end', () => resolve(entries))
			zip.on('entry', entry => zip.openReadStream(entry, (error, stream) => {
				if (error) return reject(error)
				const chunks = []
				stream.on('error', reject).on('data', chunk => chunks.push(chunk)).on('end', () => { entries[entry.fileName] = Buffer.concat(chunks); zip.readEntry() })
			}))
			zip.readEntry()
		})
	})
}

test('hosted storage requires explicit enablement, original settings, upload access and anonymous reads', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hosted-report-'))
	try {
		assert.equal(await prepareSession(dir, {}, {}), null)
		const client = fakeClient()
		const checks = []
		const filename = await prepareSession(dir, env, client, async (url, options) => { checks.push({url, options}); return {ok:true} })
		const session = JSON.parse(fs.readFileSync(filename))
		assert.equal(session.bucket, env.S3_BUCKET)
		assert.equal(checks[0].options.method, 'HEAD')
		assert.equal(checks[0].options.redirect, 'error')
		assert.ok(!fs.readFileSync(filename, 'utf8').includes('synthetic'))
		assert.equal(client.uploads[0].ContentType, 'text/plain')
		await assert.rejects(prepareSession(dir, {...env,S3_BUCKET:'https://bucket.invalid'}, fakeClient()), /configuration/)
		await assert.rejects(prepareSession(dir, {...env,S3_SECRET:''}, fakeClient()), /configuration/)
		await assert.rejects(prepareSession(dir, env, fakeClient(), async()=>({ok:false})), /report_not_readable/)
		await assert.rejects(prepareSession(dir, env, {send:async()=>{throw Error('AccessDenied')}}, async()=>({ok:true})))
		const next = JSON.parse(fs.readFileSync(await prepareSession(dir, env, fakeClient(), async()=>({ok:true}))))
		assert.notEqual(session.prefix, next.prefix)
		assert.equal(errorCode(new Error(canary)), 'upload_failed')
	} finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('public metadata only permits hosted S3 report links and fixed diagnostic codes', () => {
	const url=objectUrl({bucket:env.S3_BUCKET,region:env.S3_REGION},'ca-123/1/run/index.html')
	assert.equal(safeReportUrl(url),url)
	const dotted=objectUrl({bucket:'reports.example',region:env.S3_REGION},'ca-123/1/run/index.html')
	assert.equal(safeReportUrl(dotted),dotted)
	for(const bad of [url+'?token=secret',url.replace('amazonaws.com','amazonaws.com.evil.test'),url.replace('https://','https://user:secret@'),url.replace('index.html','video.webm')]) assert.equal(safeReportUrl(bad),null)
	assert.throws(()=>sanitizeHostedReport({status:'complete',uploaded:1,failed:0,bytes:12,url:'https://example.com/secret'}))
	assert.throws(()=>sanitizeHostedReport({status:'incomplete',uploaded:0,failed:1,bytes:0,error:canary}))
})

test('report upload preserves assets/content types, publishes index last, and withholds broken links', async () => {
	const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hosted-report-'))
	const session={bucket:env.S3_BUCKET,region:env.S3_REGION,prefix:'ca-123/1/run/',reportDir:path.join(dir,'playwright-report')}
	try {
		fs.mkdirSync(path.join(session.reportDir,'data'),{recursive:true})
		fs.writeFileSync(path.join(session.reportDir,'index.html'),'<h1>Report</h1>')
		fs.writeFileSync(path.join(session.reportDir,'data','video.webm'),canary)
		const client=fakeClient(), checks=[]
		const result=await uploadReport(session,{client,fetcher:async url=>{checks.push(url);return {ok:true}}})
		assert.equal(result.status,'complete')
		assert.equal(result.uploaded,2)
		assert.equal(client.uploads[0].Key,session.prefix+'data/video.webm')
		assert.equal(client.uploads[0].ContentType,'video/webm')
		assert.equal(client.uploads.at(-1).Key,session.prefix+'index.html')
		assert.match(client.uploads.at(-1).ContentType,/text\/html/)
		assert.equal(result.url,checks.at(-1))
		assert.ok(!client.uploads.some(item=>item.ACL))
		const denied=await uploadReport(session,{client:fakeClient(),fetcher:async()=>({ok:false})})
		assert.equal(denied.error,'report_not_readable')
		assert.equal(denied.url,undefined)
		const failed=await uploadReport(session,{client:{send:async()=>{throw Error(canary)}},fetcher:async()=>({ok:true})})
		assert.equal(failed.error,'upload_failed')
		assert.ok(!JSON.stringify(failed).includes(canary))
		fs.symlinkSync(path.join(session.reportDir,'index.html'),path.join(session.reportDir,'linked.html'))
		assert.equal((await uploadReport(session,{client:fakeClient(),fetcher:async()=>({ok:true})})).error,'report_failed')
	} finally {fs.rmSync(dir,{recursive:true,force:true})}
})

test('real hosted HTML contains test details and videos; Slack receives a working report button', {timeout:120000}, async()=>{
	const dir=fs.mkdtempSync(path.join(root,'.hosted-report-fixture-'))
	try {
		const uploads=path.join(dir,'uploads'), health=path.join(dir,'health.json'), slack=path.join(dir,'slack.json'), summary=path.join(dir,'summary.json'), step=path.join(dir,'step.md')
		const shim=path.join(dir,'fake-s3.cjs')
		fs.writeFileSync(shim,`
const fs=require('fs'),path=require('path'),Module=require('module');const original=Module._load;const sdk=require('@aws-sdk/client-s3');
class S3Client {
 async send(command){
  const input=command.input;
  if(process.env.SYNTHETIC_UPLOAD_DENIED==='true'&&input.ContentType==='video/webm')throw Error(${JSON.stringify(canary)});
  const file=path.join(${JSON.stringify(uploads)},input.Key);fs.mkdirSync(path.dirname(file),{recursive:true});
  if(typeof input.Body==='string')fs.writeFileSync(file,input.Body);else{const chunks=[];for await(const chunk of input.Body)chunks.push(chunk);fs.writeFileSync(file,Buffer.concat(chunks));}
  return {};
 }
 destroy(){}
}
Module._load=function(name,...args){return name==='@aws-sdk/client-s3'?{...sdk,S3Client}:original.call(this,name,...args)};
global.fetch=async(url,options)=>{
 if(options.method==='HEAD')return {ok:fs.existsSync(path.join(${JSON.stringify(uploads)},new URL(url).pathname.slice(1)))};
 if(url==='https://notification.invalid/'){fs.writeFileSync(${JSON.stringify(slack)},options.body);return {ok:true};}
 throw Error('Unexpected network request');
};
`)
		const config=path.join(dir,'config.cjs')
		fs.writeFileSync(config,`module.exports={
 testDir:__dirname,testMatch:'probe.spec.cjs',workers:1,retries:1,outputDir:${JSON.stringify(path.join(dir,'results'))},
 reporter:${JSON.stringify(['reporters/security/public-summary-reporter.cjs','reporters/slack/pw-slack-webhook-reporter.ts','reporters/health/pw-health-json-reporter.ts'].map(file=>[path.join(root,file)]))},
 use:{trace:'off',screenshot:'off',headless:true,video:require(${JSON.stringify(path.join(root,'scripts/hosted-reports/session'))}).hostedVideoMode()}
}`)
		fs.writeFileSync(path.join(dir,'probe.spec.cjs'),`
const {test,expect}=require('@playwright/test');
for(const mode of ['pass','fail','retry'])test(mode+${JSON.stringify(canary)},async({page},info)=>{
 await page.setContent('<h1>Synthetic hosted report</h1>');await page.waitForTimeout(250);console.log(${JSON.stringify(canary)});
 await test.step('synthetic-step',async()=>{if(mode==='fail'||(mode==='retry'&&info.retry===0))expect(true).toBe(false)});
});
`)
		const runEnv={PATH:process.env.PATH,HOME:process.env.HOME,CI:'true',NODE_OPTIONS:`--require=${shim}`,...env,
			PUBLIC_SUMMARY_FILE:summary,HEALTH_RESULT_FILE:health,GITHUB_STEP_SUMMARY:step,SLACK_WEBHOOK_URL:'https://notification.invalid/',
			PLAYWRIGHT_HTML_ATTACHMENTS_BASE_URL:'https://must-not-use.invalid/',PLAYWRIGHT_HTML_OPEN:'always'}
		const result=spawnSync(process.execPath,['scripts/run-public-playwright.js','--config',config],{cwd:root,encoding:'utf8',timeout:90000,env:runEnv})
		assert.equal(result.status,1,result.stdout+result.stderr)
		assert.ok(fs.existsSync(summary),result.stdout+result.stderr)
		const output=JSON.parse(fs.readFileSync(summary,'utf8'))
		assert.deepEqual(output.counts,{passed:1,failed:1,flaky:1,skipped:0},result.stdout+result.stderr)
		assert.equal(output.hostedReport.status,'complete',result.stdout+result.stderr)
		assert.equal(JSON.parse(fs.readFileSync(health)).reportUrl,output.hostedReport.url)
		const reportDir=path.dirname(path.join(uploads,new URL(output.hostedReport.url).pathname))
		const html=fs.readFileSync(path.join(reportDir,'index.html'),'utf8')
		const data=await zipContents(Buffer.from(html.match(/window.playwrightReportBase64 = "data:application\/zip;base64,([^"]+)"/)[1],'base64'))
		const reportData=Object.values(data).map(buffer=>buffer.toString()).join('\n')
		assert.ok(reportData.includes(canary))
		assert.ok(reportData.includes('synthetic-step'))
		assert.ok(reportData.includes('flaky'))
		assert.ok(!reportData.includes('must-not-use.invalid'))
		const videos=fs.readdirSync(path.join(reportDir,'data')).filter(file=>file.endsWith('.webm'))
		assert.equal(videos.length,3)
		for(const video of videos){assert.ok(reportData.includes('data/'+video));assert.equal(fs.readFileSync(path.join(reportDir,'data',video)).subarray(0,4).toString('hex'),'1a45dfa3')}
		const message=JSON.parse(fs.readFileSync(slack))
		assert.ok(message.blocks.some(block=>block.elements?.some(button=>button.text?.text==='Test Report'&&button.url===output.hostedReport.url)))
		for(const file of [summary,health,slack,step]){const text=fs.readFileSync(file,'utf8');assert.ok(!text.includes(canary),file);assert.ok(text.includes('.amazonaws.com'),file)}
		assert.ok(!`${result.stdout}${result.stderr}`.includes(canary))
		const denied=spawnSync(process.execPath,['scripts/run-public-playwright.js','--config',config,'--grep','retry'],{cwd:root,encoding:'utf8',timeout:30000,env:{...runEnv,SYNTHETIC_UPLOAD_DENIED:'true'}})
		assert.equal(denied.status,1)
		const failed=JSON.parse(fs.readFileSync(summary))
		assert.equal(failed.counts.flaky,1)
		assert.equal(failed.status,'failed')
		assert.equal(failed.hostedReport.status,'incomplete')
		assert.equal(failed.hostedReport.url,undefined)
		assert.equal(JSON.parse(fs.readFileSync(health)).status,'failed')
		assert.match(fs.readFileSync(slack,'utf8'),/upload was incomplete/)
		assert.ok(!fs.readFileSync(slack,'utf8').includes('Test Report'))
		const passed=spawnSync(process.execPath,['scripts/run-public-playwright.js','--config',config,'--grep','pass'],{cwd:root,encoding:'utf8',timeout:30000,env:runEnv})
		assert.equal(passed.status,0,passed.stdout+passed.stderr)
		const green=JSON.parse(fs.readFileSync(summary))
		assert.equal(green.status,'passed')
		assert.equal(green.hostedReport.status,'complete')
	} finally {fs.rmSync(dir,{recursive:true,force:true})}
})
