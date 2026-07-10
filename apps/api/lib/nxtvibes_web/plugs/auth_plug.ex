defmodule NxtVibesWeb.Plugs.AuthPlug do
  require Logger
  import Plug.Conn
  alias NxtVibes.Auth.Token

  def init(opts), do: opts

  def call(conn, _opts) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] ->
        # DEBUG: decode header + payload without verification so we can see what claims/alg the token has
        log_token_info(token)

        case Token.verify_token(token) do
          {:ok, %{"sub" => user_id}} ->
            assign(conn, :current_user_id, user_id)

          {:error, reason} ->
            Logger.error("[AuthPlug] verify_token FAILED: #{inspect(reason)}")
            unauthorized(conn, "Invalid or expired token")
        end

      _ ->
        unauthorized(conn, "Missing authorization header")
    end
  end

  # ---------------------------------------------------------------------------
  # Temporary debug helper — decode and log the JWT without verifying it
  # ---------------------------------------------------------------------------
  defp log_token_info(token) do
    parts = String.split(token, ".")

    with [header_b64, payload_b64 | _] <- parts,
         {:ok, header_json} <- Base.url_decode64(header_b64, padding: false),
         {:ok, header} <- Jason.decode(header_json),
         {:ok, payload_json} <- Base.url_decode64(payload_b64, padding: false),
         {:ok, payload} <- Jason.decode(payload_json) do
      alg = header["alg"] || "unknown"
      kid = header["kid"] || "none"
      aud = payload["aud"]
      sub = payload["sub"]
      exp = payload["exp"]
      role = payload["role"]
      now = System.system_time(:second)
      expired = if is_integer(exp), do: exp < now, else: "unknown"

      Logger.info("[AuthPlug] Token decoded: alg=#{alg} kid=#{kid} sub=#{sub} aud=#{inspect(aud)} role=#{role} exp_ok=#{not expired}")
    else
      err -> Logger.warning("[AuthPlug] Could not decode token: #{inspect(err)}")
    end
  end

  defp unauthorized(conn, message) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(401, Jason.encode!(%{error: message}))
    |> halt()
  end
end
