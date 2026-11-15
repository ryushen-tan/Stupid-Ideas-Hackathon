import { config } from "dotenv";
config({ path: "server/.env", quiet: true });
async function main() {
  const response = await fetch(
    "https://app.backboard.io/api/models?supports_vision=true&supports_json_output=true&limit=100",
    { headers: { "X-API-Key": process.env.BACKBOARD_API_KEY! } },
  );
  if (!response.ok)
    throw new Error(`Model discovery failed (${response.status})`);
  const body = (await response.json()) as {
    models: {
      name: string;
      provider: string;
      supports_vision: boolean;
      supports_json_output: boolean;
    }[];
  };
  console.log(
    body.models
      .filter((model) => model.provider === "openai")
      .map((model) => ({
        name: model.name,
        vision: model.supports_vision,
        json: model.supports_json_output,
      })),
  );
}
void main();
