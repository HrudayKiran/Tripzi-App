defmodule NxtVibes.Repo do
  use Ecto.Repo,
    otp_app: :nxtvibes,
    adapter: Ecto.Adapters.Postgres
end
