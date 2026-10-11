import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { startStandaloneServer } from "@apollo/server/standalone";
import { config } from "./config";
import { startInventoryResultConsumer } from "./consumer";
import { migrate, pool } from "./db";
import { TOPICS } from "./events";
import { resolvers, typeDefs } from "./graphql";
import { ensureTopics, kafka } from "./kafka";
import { startOutboxPublisher } from "./outbox";

async function main() {
  await migrate();
  await ensureTopics(Object.values(TOPICS));

  const producer = kafka.producer({ allowAutoTopicCreation: false });
  await producer.connect();
  const stopOutbox = startOutboxPublisher(producer);
  const consumer = await startInventoryResultConsumer();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    // Demo project: keep the in-browser GraphQL explorer + introspection on even in Docker (NODE_ENV=production).
    introspection: true,
    plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
  });
  const { url } = await startStandaloneServer(server, { listen: { port: config.port } });
  console.log(`[order] GraphQL ready at ${url}`);

  const shutdown = async () => {
    console.log("[order] shutting down...");
    stopOutbox();
    await server.stop();
    await consumer.disconnect();
    await producer.disconnect();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[order] fatal:", err);
  process.exit(1);
});
