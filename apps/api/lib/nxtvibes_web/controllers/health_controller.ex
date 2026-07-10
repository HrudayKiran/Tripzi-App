defmodule NxtVibesWeb.HealthController do
  use NxtVibesWeb, :controller

  def check(conn, _params) do
    json(conn, %{status: "ok", timestamp: DateTime.utc_now()})
  end
end
