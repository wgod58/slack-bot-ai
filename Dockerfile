# Use the official Node.js image as a base
FROM node:18-slim

# Create non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs -s /bin/false nodejs

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy build code
COPY ./dist /app

# Set ownership and permissions
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the port your app runs on
EXPOSE 8080

# Add HEALTHCHECK instruction
HEALTHCHECK --interval=600s --timeout=5s --retries=3 CMD curl -f http://localhost:8080/api/up || exit 1

# Command to run your application
CMD [ "node","./app.js" ]