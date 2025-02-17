# Use the official Node.js image as a base
FROM node:18

# Create non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs -s /bin/false nodejs

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Clean yarn cache
RUN yarn cache clean

# Install dependencies
RUN yarn install

# Copy build code
COPY ./dist /app

# Copy .env file
COPY ./.env /app

# Set ownership and permissions
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the port your app runs on
EXPOSE 8080

# Add HEALTHCHECK instruction
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -f http://localhost:8080/ || exit 1

# Command to run your application
CMD [ "yarn","run","start:docker" ]