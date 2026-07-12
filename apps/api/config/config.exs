# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

# Load environment variables natively from apps/api/.env early in boot
env_path = Path.expand("../.env", __DIR__)

if File.exists?(env_path) do
  File.stream!(env_path)
  |> Stream.map(&String.trim/1)
  |> Stream.filter(fn line -> line != "" and not String.starts_with?(line, "#") end)
  |> Enum.each(fn line ->
    case String.split(line, "=", parts: 2) do
      [key, val] ->
        trimmed_val = String.trim(val)
        clean_val =
          if String.starts_with?(trimmed_val, "\"") and String.ends_with?(trimmed_val, "\"") do
            String.slice(trimmed_val, 1, String.length(trimmed_val) - 2)
          else
            trimmed_val
          end
        System.put_env(String.trim(key), clean_val)
      _ -> :ok
    end
  end)
end

config :nxtvibes,
  ecto_repos: [NxtVibes.Repo],
  generators: [timestamp_type: :utc_datetime, binary_id: true]

# Configures the endpoint
config :nxtvibes, NxtVibesWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [json: NxtVibesWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: NxtVibes.PubSub,
  live_view: [signing_salt: "Dq4P8jR3"]

# Configures Elixir's Logger
config :logger, :console,
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
     crontab: [
       # Runs daily at 8:00 AM IST (2:30 AM UTC)
       {"30 2 * * *", NxtVibes.Workers.TripLifecycleWorker}
     ]},
    # Prune completed/discarded jobs older than 7 days to prevent unbounded table growth
    {Oban.Plugins.Pruner, max_age: 60 * 60 * 24 * 7}
  ]



# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
