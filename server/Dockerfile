FROM node:22-alpine
WORKDIR /app
COPY *.mjs ./
RUN mkdir /data && chown node:node /data
ENV DATA_DIR=/data PORT=8787
VOLUME /data
EXPOSE 8787
USER node
CMD ["node", "index.mjs"]
