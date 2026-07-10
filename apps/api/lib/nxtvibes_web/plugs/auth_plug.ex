defmodule NxtVibesWeb.Plugs.AuthPlug do
  import Plug.Conn
  alias NxtVibes.Auth.Token

  def init(opts), do: opts

  def call(conn, _opts) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] ->
        case Token.verify_token(token) do
          {:ok, %{"sub" => user_id}} ->
            assign(conn, :current_user_id, user_id)

          {:error, _reason} ->
            unauthorized(conn, "Invalid or expired token")
        end

      _ ->
        unauthorized(conn, "Missing authorization header")
    end
  end

  defp unauthorized(conn, message) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(401, Jason.encode!(%{error: message}))
    |> halt()
  end
end
