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

This node uses AWS Bedrock inference profiles for optimal performance and availability:

- **Claude 3.5 Sonnet v2** - `us.anthropic.claude-3-5-sonnet-20241022-v2:0` (default)
- **Claude 3.5 Sonnet v1** - `us.anthropic.claude-3-5-sonnet-20240620-v1:0`
- **Claude 3.5 Haiku** - `us.anthropic.claude-3-5-haiku-20241022-v1:0`
- **Claude 3.7 Sonnet** - `us.anthropic.claude-3-7-sonnet-20250219-v1:0`
- **Claude Sonnet 4** - `us.anthropic.claude-sonnet-4-20250514-v1:0`
- **Claude Sonnet 4.5** - `us.anthropic.claude-sonnet-4-5-20250929-v1:0`
- **Claude Haiku 4.5** - `us.anthropic.claude-haiku-4-5-20251001-v1:0`
- **Claude Opus 4** - `us.anthropic.claude-opus-4-20250514-v1:0`
- **Claude Opus 4.1** - `us.anthropic.claude-opus-4-1-20250805-v1:0`
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

### 4. Application Inference Profiles

This node supports AWS Bedrock Application Inference Profiles, allowing you to route traffic through specific profiles for cost and usage tracking.

#### 4.1. Credential configuration

In the **AWS AssumeRole** credential, you can optionally configure:

- **Application Inference Profile Account ID**: The AWS account ID where your application inference profiles live.
- **Application Inference Profiles JSON**: A JSON object mapping Bedrock model IDs to application inference profile IDs.

Example JSON:

```json
{
  "us.anthropic.claude-3-5-sonnet-20240620-v1:0": "hs4uvikaus5b",
  "us.anthropic.claude-3-5-sonnet-20241022-v2:0": "0xumpou8xusv",
  "us.anthropic.claude-3-5-haiku-20241022-v1:0": "abc123haiku"
}
```

- The **key** is the Bedrock model ID (for example, `us.anthropic.claude-3-5-sonnet-20241022-v2:0`).
- The **value** is the application inference profile ID (for example, `0xumpou8xusv`), not the full ARN.

The node then builds the final ARN internally using:

```text
arn:aws:bedrock:{region}:{account-id}:application-inference-profile/{profile-id}
```

If the JSON is invalid, the node will fail with a clear error message pointing to the `Application Inference Profiles JSON` field.

#### 4.2. Model dropdown behaviour

The **Model ID** dropdown in the node behaves as follows:

- If **Application Inference Profiles JSON** is **empty or not set**:
  - The dropdown shows all supported Claude models (the default static list).
- If **Application Inference Profiles JSON** is **present and valid**:
  - The dropdown shows **only the models present in that JSON**.
  - Known model IDs are displayed with friendly names (for example, "Claude 3.5 Sonnet v2"), unknown ones are shown as their raw model ID.

This ensures that, when you configure specific models and profiles in the credential, users of the node can only select those models.

#### 4.3. Backwards compatibility

If no application inference profile mapping is found for a selected model ID, the node will:

1. Try the legacy single **Application Inference Profile ID** field (if configured).
2. Otherwise, fall back to using the raw model ID directly (original behaviour).


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


### Image analysis workflow (Text and Image input)

To analyze an image together with a text prompt using Claude models that support vision capabilities:

1. Add a **Form Trigger** (or any node that outputs binary data) with a file field, for example labeled `image_to_analize`.
2. Connect that node to **AWS Bedrock (AssumeRole)**.
3. Configure the Bedrock node:
   - **Model ID**: Select any Claude model that supports image input (for example, Claude Sonnet 4).
   - **Input Type**: Set to `Text and Image`.
   - **Image Binary Property**: Set to the name of the binary field that contains the uploaded image. For a Form Trigger file field labeled `image_to_analize`, the binary key is also `image_to_analize`.
   - **Prompt**: Provide the instruction you want to send together with the image, for example: `Describe what is written in this image.`
4. Execute the workflow by submitting the form with an image file.

You can import the ready-to-use example workflow from `examples/image-analysis-workflow.json`.

### Response Format

The node returns a JSON object with:

```json
{
  "modelId": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
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

## Development

### Quick Start with Make

This project includes a Makefile for easy development and deployment:

```bash
# Show all available commands
make help

# Development
make install      # Install dependencies
make build        # Build the project
make dev          # Build and start Docker for local testing
make clean        # Clean build artifacts

# Docker
make docker-up    # Start Docker containers
make docker-down  # Stop Docker containers
make docker-logs  # Show Docker logs

# Deployment
make publish      # Publish to npm (interactive)
make sync         # Sync repositories (GitHub + GitLab)
make release      # Full release: build + publish + sync
```

### Publishing a New Version

The `make publish` command provides an interactive workflow that handles everything:

#### Step 1: Version Bump
Choose the type of version bump:
- **patch** (1.0.2 → 1.0.3) - Bug fixes
- **minor** (1.0.2 → 1.1.0) - New features (backwards compatible)
- **major** (1.0.2 → 2.0.0) - Breaking changes
- **custom** - Specify version manually

#### Step 2: Changelog Generation
Select the types of changes included:
1. **Added** - New features
2. **Changed** - Changes in existing functionality
3. **Deprecated** - Soon-to-be removed features
4. **Removed** - Removed features
5. **Fixed** - Bug fixes
6. **Security** - Security fixes

#### Step 3: Changelog Entries
Enter detailed changes for each selected section. The script will automatically:
- Update `CHANGELOG.md` with proper formatting
- Follow [Keep a Changelog](https://keepachangelog.com/) format
- Add the current date
- Insert the new entry at the top

#### Step 4: Build & Publish
The script will:
- Build the project (`npm run build`)
- Publish to npm with public access
- Commit changes to `package.json`, `package-lock.json`, and `CHANGELOG.md`
- Create a git tag (e.g., `v1.0.2`)

#### Example Workflow

```bash
# Start the publish process
make publish

# Follow the prompts:
# 1. Select version bump: 1 (patch)
# 2. Select change types: 5 (Fixed)
# 3. Enter changes:
#    - Fixed custom SVG icons not displaying correctly
#    - Removed unused code and imports
# 4. Confirm publish: y

# After publishing, sync repositories
make sync

# Or do everything in one command:
make release
```

### Repository Sync

The project supports syncing to multiple repositories:
- **GitHub**: https://github.com/cabify/n8n-nodes-aws-bedrock-assumerole
- **GitLab**: https://gitlab.otters.xyz/platform/business-automation/n8n-nodes-aws-bedrock-assumerole

The `make sync` command will:
- Push code to both GitHub and GitLab
- Push all tags to both repositories
- Verify you're on the main branch
- Show current status before pushing

### Manual Development

If you prefer not to use Make:

```bash
# Install dependencies
npm install

# Build
npm run build

# Start Docker for testing
docker-compose up -d

# View logs
docker-compose logs -f n8n

# Publish manually
npm version patch  # or minor, major
npm run build
npm publish --access public
git push && git push --tags
```

### Project Structure

```
n8n-bedrock-node/
├── credentials/
│   ├── AwsAssumeRole.credentials.ts  # Credential definition
│   └── aws.svg                        # AWS icon
├── nodes/
│   ├── AwsBedrockAssumeRole.node.ts  # Main node implementation
│   └── bedrock.svg                    # Bedrock icon
├── icons/
│   ├── aws.svg                        # Source AWS icon
│   └── bedrock.svg                    # Source Bedrock icon
├── dist/                              # Compiled output
├── docker-compose.yml                 # Local development setup
├── Makefile                           # Development commands
├── publish-npm.sh                     # npm publish script
├── sync-repos.sh                      # Repository sync script
└── package.json                       # Package configuration
```

### Scripts

- `npm run build` - Compile TypeScript and copy icons
- `npm run copy-icons` - Copy icons to dist directories
- `npm run lint` - Run ESLint (requires setup)
- `npm test` - Run tests (if available)

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
