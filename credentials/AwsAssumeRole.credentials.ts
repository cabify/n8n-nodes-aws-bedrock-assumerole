import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class AwsAssumeRole implements ICredentialType {
	name = 'awsAssumeRole';
	displayName = 'AWS Assume Role';
	documentationUrl = 'https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html';
	icon: Icon = 'fa:key';
	
	properties: INodeProperties[] = [
		{
			displayName: 'Access Key ID',
			name: 'accessKeyId',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: false,
			placeholder: 'Leave empty (uses server environment variable by default)',
			description: 'Leave empty to use the server AWS_ACCESS_KEY_ID environment variable (recommended). Only fill if you need to use different credentials.',
		},
		{
			displayName: 'Secret Access Key',
			name: 'secretAccessKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: false,
			placeholder: 'Leave empty (uses server environment variable by default)',
			description: 'Leave empty to use the server AWS_SECRET_ACCESS_KEY environment variable (recommended). Only fill if you need to use different credentials.',
		},
		{
			displayName: 'Role ARN to Assume',
			name: 'roleArn',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'arn:aws:iam::<account-id>:role/<role-name>',
			description: 'Role ARN to assume in the target account',
		},
		{
			displayName: 'AWS Region',
			name: 'region',
			type: 'string',
			default: 'us-east-1',
			required: false,
			placeholder: 'us-east-1',
			description: 'AWS region for the STS and Bedrock services',
		},
		{
			displayName: 'Session Duration (seconds)',
			name: 'durationSeconds',
			type: 'number',
			default: 3600,
			required: false,
			description: 'Duration of the assumed role session in seconds (default: 3600 = 1 hour)',
		},
	];

	// Generic authentication method - we'll handle the AssumeRole logic in the node
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://sts.amazonaws.com',
			url: '/',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-amz-json-1.0',
				'X-Amz-Target': 'AWSSecurityTokenServiceV20110615.GetCallerIdentity',
			},
		},
	};
}
