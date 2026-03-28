const { startServer } = require("./server");
const { startBot } = require("./bot");

async function main() {
  await startServer();
  await startBot();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

