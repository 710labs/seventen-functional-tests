import { Block, KnownBlock } from '@slack/types';
import { SummaryResults } from "playwright-slack-report/dist/src";
import fs from "fs";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
const web_api_1 = require('@slack/web-api');
const slackClient = new web_api_1.WebClient(process.env.SLACK_BOT_USER_OAUTH_TOKEN);


const s3Client = new S3Client({
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "",
        secretAccessKey: process.env.S3_SECRET || "",
    },
    region: process.env.S3_REGION,
});

async function uploadFile(filePath) {
    try {
        const result = await slackClient.files.uploadV2({
            channels: 'you_cannel_name',
            file: fs.createReadStream(filePath),
            filename: filePath.split('/').at(-1),
        });

        return result.file;
    } catch (err) {
        console.log("🔥🔥 Error", err);
    }
}

export async function generateCustomLayoutAsync(summaryResults: SummaryResults): Promise<Array<KnownBlock | Block>> {
    const maxNumberOfFailures = 10;
    const maxNumberOfFailureLength = 650;
    const fails: any[] = [];
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

            const assets: Array<object> = [];
            if (attachments) {
                for (const a of attachments) {
                    // Upload failed tests screenshots and videos to the service of your choice
                    // In my case I upload the to S3 bucket
                    const file = await uploadFile(
                        a.path
                    );

                    if (file) {
                        if (a.name === 'screenshot' && file.permalink) {
                            assets.push({
                                alt_text: reason,
                                image_url: file.permalink,
                                title: { type: 'plain_text', text: file.name || '' },
                                type: 'image',
                            });
                        }

                        if (a.name === 'video' && file.permalink) {
                            assets.push({
                                alt_text: reason,
                                thumbnail_url: process.env.DEFAULT_VIDEO_PREVIEW_URL,
                                title: { type: 'plain_text', text: file.name || '' },
                                type: 'video',
                                video_url: file.permalink,
                            });
                        }
                    }
                }
            }
            if (assets.length > 0) {
                fails.concat(assets)
            };
        }
        if (i > maxNumberOfFailures) {
            fails.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: '*There are too many failures to display, view the full results in BuildKite*',
                },
            });
            break;
        }
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
    {
        type: "header",
        text: {
            type: "plain_text",
            text: "🎭 *710 Labs Test Results*",
            emoji: true,
        },
    },
    ...meta,
    {
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: `:white_check_mark: *${summaryResults.passed
                }* Tests ran successfully \n\n :red_circle: *${summaryResults.failed
                }* Tests failed \n\n ${summaryResults.skipped > 0
                    ? `:fast_forward: *${summaryResults.skipped}* skipped`
                    : ''
                } \n\n `,
        },
    },
    {
        type: 'divider',
    },
    ...fails,
];
}






export default generateCustomLayoutAsync;