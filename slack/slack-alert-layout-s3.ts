import { Block, KnownBlock } from '@slack/types';
import { SummaryResults } from "playwright-slack-report/dist/src";
import fs from "fs";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";


const s3Client = new S3Client({
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "",
        secretAccessKey: process.env.S3_SECRET || "",
    },
    region: process.env.S3_REGION,
});

async function uploadFile(type, filePath, fileName) {
    try {
        const ext = path.extname(filePath);
        const name = `${fileName}${ext}`;

        if (type === 'screenshot') {
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: process.env.S3_BUCKET,
                    Key: name,
                    Body: fs.createReadStream(filePath),
                    ContentType: 'image/png',
                    ContentDisposition: 'inline'
                })
            );
        }
        if (type === 'video') {
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: process.env.S3_BUCKET,
                    Key: name,
                    Body: fs.createReadStream(filePath),
                    ContentType: 'video/webm',
                    ContentDisposition: 'inline'
                })
            );
        }
        if (type === 'trace') {
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: process.env.S3_BUCKET,
                    Key: name,
                    Body: fs.createReadStream(filePath),
                    ContentType: 'application/zip',
                    ContentDisposition: 'inline'
                })
            );
        }


        return `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${name}`;
    } catch (err) {
        console.log("🔥🔥 Error", err);
    }
}

export async function generateCustomLayoutAsync(summaryResults: SummaryResults): Promise<Array<KnownBlock | Block>> {
    const maxNumberOfFailures = 5;
    const maxNumberOfFailureLength = 700;
    const fails: any[] = [];
    const failSummary: any[] = [];
    const passSummary: any[] = [];
    const skipSummary: any[] = [];
    var failSummaryText: string = '';
    var passSummaryText: string = '';
    var skipSummaryText: string = '';
    const Summary: any[] = [];
    const meta: any[] = [];

    for (let i = 0; i < summaryResults.failures.length; i += 1) {
        const { reason, name, attachments, suiteName, status } = summaryResults.tests[i]
        if (status === "failed") {
            const formattedFailure = reason
                .substring(0, maxNumberOfFailureLength)
                .split('\n')
                .map((l) => `>${l}`)
                .join('\n');

            fails.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*${name}*
        \n\n${formattedFailure}`,
                },
            });

            const assets: Array<string> = [];
            if (attachments) {
                for (const a of attachments) {
                    // Upload failed tests screenshots and videos to the service of your choice
                    // In my case I upload the to S3 bucket
                    var permalink = await uploadFile(a.name,
                        a.path,
                        `${suiteName}--${name}`.replace(/\W/gi, "-").toLowerCase()
                    );

                    if (permalink) {
                        let icon = "";
                        if (a.name === "screenshot") {
                            icon = "📸";
                        } else if (a.name === "video") {
                            icon = "🎥";
                        }
                        else if (a.name === "trace") {
                            icon = "📋"
                            permalink = `https://trace.playwright.dev/?trace=${permalink}`
                        }

                        assets.push(`${icon}  See the <${permalink}|${a.name}>`);
                    }
                }
            }
            if (assets.length > 0) {
                fails.push({
                    type: "context",
                    elements: [{ type: "mrkdwn", text: assets.join("\n") }],
                });
            }
            if (i > maxNumberOfFailures) {
                fails.push({
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `Holy 💩! There were more than ${maxNumberOfFailures} failures. Checkout the videos, screenshots, and traces above and find out why. `,
                    },
                });
                break;
            }
        }

    }

    for (let i = 0; i < summaryResults.tests.length; i += 1) {
        const { name, startedAt, status } = summaryResults.tests[i];
        if (status === "passed") {
            passSummary.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `\n${name} [${startedAt}]`,
                },
            }
            )
            passSummaryText = passSummary.join('')
        }
        if (status === "failed") {
            failSummary.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `\n${name} [${startedAt}]`,
                },
            }
            )
            failSummaryText = failSummary.join('')
        }
        if (status === "skipped") {
            skipSummary.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `\n${name} [${startedAt}]`,
                },
            }
            )
            skipSummaryText = skipSummary.join('');
        }
    }


    if (summaryResults.meta) {
        for (let i = 0; i < summaryResults.meta.length; i += 1) {
            const { key, value } = summaryResults.meta[i];
            meta.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `\n*${key}* :\t${value}`,
                },
            });
        }
    }
    return [
        ...meta,
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `\n\n:white_check_mark: *${summaryResults.passed}* Tests ran successfully \n\n ${passSummaryText}`,
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `\n\n:red_circle: *${summaryResults.failed}* Tests failed \n\n ${failSummaryText} `,
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `\n\n:fast_forward: *${summaryResults.skipped}* skipped\n\n ${skipSummaryText}`
            },
        },

        {
            type: 'divider',
        },
        ...fails,
    ];
}






export default generateCustomLayoutAsync;