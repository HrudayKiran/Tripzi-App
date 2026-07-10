defmodule NxtVibes.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      NxtVibesWeb.Telemetry,
      NxtVibes.Repo,

      {DNSCluster, query: Application.get_env(:nxtvibes, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: NxtVibes.PubSub},
      NxtVibesWeb.Presence,
      {Oban, Application.fetch_env!(:nxtvibes, Oban)},
      # Start to serve requests, typically the last entry
      NxtVibesWeb.Endpoint
    ]

    # See https://elixir.hexdocs.pm/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: NxtVibes.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    NxtVibesWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
