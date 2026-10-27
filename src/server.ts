import { createServer } from "node:http";

const port = 3000;

const server = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Hello world\n");
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});