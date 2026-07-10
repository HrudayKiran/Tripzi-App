import Config

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
database_url = System.get_env("DATABASE_TEST_URL")

repo_config =
  if database_url do
    [url: database_url]
  else
    [
      username: "postgres",
      password: "postgres",
      hostname: "localhost",
      database: "nxtvibes_test#{System.get_env("MIX_TEST_PARTITION")}"
    ]
  end

config :nxtvibes, NxtVibes.Repo,
  repo_config ++
    [
      pool: Ecto.Adapters.SQL.Sandbox,
      pool_size: System.schedulers_online() * 2
    ]

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :nxtvibes, NxtVibesWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "M0slcM0Z0xeDU5DLYKDhIAkgtEHveAF4fkxXiptk2EDiIcIk8GPYEq/C86hX5inn",
  server: false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Sort query params output of verified routes for robust url comparisons
config :phoenix,
  sort_verified_routes_query_params: true
