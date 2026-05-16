ARG NODE_VERSION=26.1.0
FROM node:${NODE_VERSION}-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV EPHEMEROS_HOST=0.0.0.0
ENV EPHEMEROS_PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY data ./data
COPY mock-secure-enclave ./mock-secure-enclave
COPY lambda ./lambda
COPY README.md SECURITY_REVIEW.md POC_PLAN.md BOB_DEMO.md BOB_INTEGRATION.md DATASET.md SUBMISSION_CHECKLIST.md HACKATHON_ALIGNMENT.md ./

EXPOSE 3000
CMD ["node", "src/server.js"]
