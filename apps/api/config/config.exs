# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

# Load environment variables natively from apps/mobile/.env early in boot
env_path = Path.expand("../../../apps/mobile/.env", __DIR__)

if File.exists?(env_path) do
  File.stream!(env_path)
  |> Stream.map(&String.trim/1)
  |> Stream.filter(fn line -> line != "" and not String.starts_with?(line, "#") end)
  |> Enum.each(fn line ->
    case String.split(line, "=", parts: 2) do
      [key, val] -> System.put_env(String.trim(key), String.trim(val))
      _ -> :ok
    end
  end)
end


config :nxtvibes,
  namespace: NxtVibes,
  ecto_repos: [NxtVibes.Repo],
  generators: [timestamp_type: :utc_datetime, binary_id: true]

# Configure the endpoint
config :nxtvibes, NxtVibesWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [json: NxtVibesWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: NxtVibes.PubSub,
  live_view: [signing_salt: "S9jHzmQn"]

# Configure Elixir's Logger
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Configure Oban for background jobs
config :nxtvibes, Oban,
  engine: Oban.Engines.Basic,
  repo: NxtVibes.Repo,
  queues: [default: 10],
  plugins: [
    {Oban.Plugins.Cron,
     crons: [
       # Runs daily at 8:00 AM IST (2:30 AM UTC)
       {"30 2 * * *", NxtVibes.Workers.TripLifecycleWorker}
     ]}
  ]

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
