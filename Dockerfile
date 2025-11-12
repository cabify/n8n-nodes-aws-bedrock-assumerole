FROM n8nio/n8n:latest

# Switch to root to install packages
USER root

# Install AWS SDK dependencies that might be needed
RUN npm install -g @aws-sdk/client-sts@^3.0.0 @aws-sdk/client-bedrock-runtime@^3.0.0

# Create custom directory and set permissions
RUN mkdir -p /home/node/.n8n/custom && \
    chown -R node:node /home/node/.n8n

# Switch back to node user
USER node

# The custom node will be mounted as a volume
# This ensures we can update it without rebuilding the image
