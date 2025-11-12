# n8n-nodes-aws-bedrock-assumerole

An n8n community node for AWS Bedrock with AssumeRole authentication support.

![n8n.io - Workflow Automation](https://raw.githubusercontent.com/n8n-io/n8n/master/assets/n8n-logo.png)

## Features

- 🔐 **AssumeRole Authentication**: Secure cross-account access using AWS STS AssumeRole
- 🤖 **Multiple Claude Models**: Support for Claude 3.5 Sonnet, Claude 3 Opus, Sonnet, Haiku, and more
- ⚡ **Credential Caching**: Automatic caching of temporary credentials with expiration handling
- 🛡️ **Error Handling**: Comprehensive error handling and logging
- 🔄 **Batch Processing**: Process multiple items in a single workflow execution
- 📊 **Usage Tracking**: Detailed usage information and response metadata

## Supported Models

- **Claude 3.5 Sonnet v2** - `anthropic.claude-3-5-sonnet-20241022-v2:0` (default)
- **Claude 3.5 Sonnet v1** - `anthropic.claude-3-5-sonnet-20240620-v1:0`
- **Claude 3.5 Haiku** - `anthropic.claude-3-5-haiku-20241022-v1:0`
- **Claude 3.7 Sonnet** - `anthropic.claude-3-7-sonnet-20250219-v1:0`
- **Claude Sonnet 4** - `anthropic.claude-sonnet-4-20250514-v1:0`
- **Claude Sonnet 4.5** - `anthropic.claude-sonnet-4-5-20250929-v1:0`
- **Claude Haiku 4.5** - `anthropic.claude-haiku-4-5-20251001-v1:0`
- **Claude Opus 4** - `anthropic.claude-opus-4-20250514-v1:0`
- **Claude Opus 4.1** - `anthropic.claude-opus-4-1-20250805-v1:0`
## Installation

### Option 1: Install from npm (Recommended)

```bash
# Install globally for n8n
npm install -g n8n-nodes-aws-bedrock-assumerole

# Or install locally in your n8n custom nodes directory
cd ~/.n8n/custom/
npm install n8n-nodes-aws-bedrock-assumerole
```

### Option 2: Install from source

```bash
# Clone the repository
git clone https://github.com/cabify/n8n-nodes-aws-bedrock-assumerole.git
cd n8n-nodes-aws-bedrock-assumerole

# Install dependencies
npm install

# Build the project
npm run build

# Link for local development
npm link

# In your n8n installation directory
npm link n8n-nodes-aws-bedrock-assumerole
```

## Configuration

### 1. AWS Credentials Setup

You have two options for providing AWS credentials:

#### Option A: Environment Variables (Recommended)
Set these environment variables on your n8n server:

```bash
export AWS_ACCESS_KEY_ID="your-access-key-id"
export AWS_SECRET_ACCESS_KEY="your-secret-access-key"
export AWS_REGION="us-east-1"
```

#### Option B: Credential Fields
Fill in the credential fields directly in the n8n UI (less secure).

### 2. Create AWS AssumeRole Credential

1. Go to **Credentials** in your n8n instance
2. Click **Add Credential**
3. Search for "AWS Assume Role"
4. Configure the following:
   - **Access Key ID**: Leave empty to use environment variable (recommended)
   - **Secret Access Key**: Leave empty to use environment variable (recommended)
   - **Role ARN to Assume**: `arn:aws:iam::<account-id>:role/<role-name>`
   - **AWS Region**: `us-east-1` (or your preferred region)
   - **Session Duration**: `3600` (1 hour, adjust as needed)

### 3. AWS IAM Setup

#### Base Account Role/User Permissions
The base AWS credentials need the following permission:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "sts:AssumeRole",
            "Resource": "arn:aws:iam::<target-account-id>:role/<target-role-name>"
        }
    ]
}
```

#### Target Account Role
The role to be assumed needs:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel"
            ],
            "Resource": [
                "arn:aws:bedrock:*::foundation-model/anthropic.*"
            ]
        }
    ]
}
```

And the trust relationship:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::<base-account-id>:role/<base-role-name>"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
```

## Usage

### Basic Workflow Example

1. **Add the AWS Bedrock (AssumeRole) node** to your workflow
2. **Select your credential** (created in step 2 above)
3. **Configure the node**:
   - **Model ID**: Choose from the dropdown (e.g., Claude 3.5 Sonnet)
   - **Prompt**: Enter your prompt or use an expression to get it from previous nodes
   - **Max Tokens**: Set the maximum response length (default: 1000)
   - **Temperature**: Control randomness (0.0 = deterministic, 1.0 = very random)

### Example Prompt

```
Analyze the following customer feedback and provide:
1. Sentiment (positive/negative/neutral)
2. Key themes
3. Suggested actions

Customer feedback: "The service was okay but the wait time was too long."
```

### Response Format

The node returns a JSON object with:

```json
{
  "modelId": "anthropic.claude-3-5-sonnet-20241022-v2:0",
  "prompt": "Your original prompt",
  "response": {
    "content": [
      {
        "text": "The AI response text",
        "type": "text"
      }
    ],
    "usage": {
      "input_tokens": 25,
      "output_tokens": 150
    }
  },
  "usage": {
    "input_tokens": 25,
    "output_tokens": 150
  },
  "content": "The AI response text",
  "timestamp": "2024-11-12T17:46:00.000Z"
}
```

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- TypeScript

### Setup

```bash
# Clone the repository
git clone https://github.com/cabify/n8n-nodes-aws-bedrock-assumerole.git
cd n8n-nodes-aws-bedrock-assumerole

# Install dependencies
npm install

# Build the project
npm run build

# Run linting
npm run lint

# Run tests
npm test
```

### Project Structure

```
n8n-nodes-aws-bedrock-assumerole/
├── credentials/
│   └── AwsAssumeRole.credentials.ts    # AWS AssumeRole credential definition
├── nodes/
│   └── AwsBedrockAssumeRole.node.ts    # Main node implementation
├── icons/
│   ├── aws.svg                         # AWS credential icon
│   └── bedrock.svg                     # Bedrock node icon
├── dist/                               # Compiled JavaScript (generated)
├── package.json                        # Package configuration
├── tsconfig.json                       # TypeScript configuration
├── .eslintrc.js                        # ESLint configuration
├── .prettierrc                         # Prettier configuration
└── README.md                           # This file
```

## Troubleshooting

### Common Issues

#### 1. "Missing AWS base credentials"
- Ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set as environment variables
- Or fill in the credential fields in the n8n UI

#### 2. "AssumeRole failed"
- Verify the Role ARN is correct
- Check that the base credentials have `sts:AssumeRole` permission
- Ensure the target role trusts the base account/role

#### 3. "Access Denied" when invoking Bedrock
- Verify the assumed role has `bedrock:InvokeModel` permission
- Check that the model ID is available in your AWS region
- Ensure Bedrock is enabled in your AWS account

#### 4. Node not appearing in n8n
- Restart n8n after installation
- Check that the package is installed in the correct location
- Verify the package.json n8n configuration is correct

### Debug Logging

The node provides detailed console logging. Check your n8n logs for:
- `[AWS Bedrock] Resolved credentials`
- `[AWS Bedrock] AssumeRole successful`
- `[AWS Bedrock] Model response received`
## Developers

This project is developed and maintained by:

- **[@fluty84](https://github.com/fluty84)** - Lead Developer & Business Automation
- **[@cHiv0rz](https://github.com/cHiv0rz)** - Infrastructure Support

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📧 Email: business-automation@cabify.com
- 🐛 Issues: [GitHub Issues](https://github.com/cabify/n8n-nodes-aws-bedrock-assumerole/issues)
- 📖 n8n Documentation: [n8n.io/docs](https://docs.n8n.io)

## Acknowledgments

- Built for the [n8n](https://n8n.io) workflow automation platform
- Uses AWS SDK v3 for optimal performance
- Inspired by the need for secure cross-account AWS Bedrock access
