defmodule NxtVibes.Auth.Token do
  require Logger
  use Joken.Config

  @impl true
  def token_config do
    # default_claims/1 is injected by `use Joken.Config`.
    # Skip iat/nbf to avoid clock-skew failures between Supabase servers and local PC.
    # Skip iss because it changes depending on the environment/Supabase project reference.
    # Signature verification guarantees the token is authentic.
    # Keep exp as a hard requirement.
    # aud validator handles: "authenticated" string, ["authenticated"] list, or missing.
    default_claims(skip: [:iat, :nbf, :iss])
    |> add_claim("aud", nil, fn aud ->
      is_nil(aud) or
      aud == "authenticated" or
      (is_list(aud) and "authenticated" in aud)
    end)
  end

  @doc """
  Verifies a Supabase JWT token.

  Supports BOTH:
    - HS256 (legacy shared secret) — used for anon/service_role keys and older session tokens
    - ES256 (ECC P-256) — Supabase's current signing algorithm for user session tokens

  The algorithm is auto-detected from the JWT header.
  ES256 verification uses the public key stored in SUPABASE_EC_X / SUPABASE_EC_Y env vars.
  NO network calls are made — the signer is built from env and cached in :persistent_term.

  Returns `{:ok, claims}` or `{:error, reason}`.
  """
  def verify_token(token) do
    case peek_alg(token) do
      "ES256" -> verify_es256(token)
      _       -> verify_hs256(token)
    end
  end

  # ---------------------------------------------------------------------------
  # HS256 — legacy Supabase shared secret (for older tokens / anon key)
  # ---------------------------------------------------------------------------

  defp verify_hs256(token) do
    jwt_secret = System.get_env("SUPABASE_JWT_SECRET")

    if is_nil(jwt_secret) or jwt_secret == "" do
      {:error, :missing_jwt_secret}
    else
      signer = Joken.Signer.create("HS256", jwt_secret)
      verify_and_validate(token, signer)
    end
  end

  # ---------------------------------------------------------------------------
  # ES256 — ECC P-256, current Supabase signing key
  # Built from SUPABASE_EC_X + SUPABASE_EC_Y env vars. Cached in :persistent_term.
  # ---------------------------------------------------------------------------

  defp verify_es256(token) do
    case get_or_build_es256_signer() do
      {:ok, signer} ->
        result = verify_and_validate(token, signer)
        if match?({:error, _}, result), do: Logger.error("[Token] ES256 verify_and_validate failed: #{inspect(result)}")
        result
      error ->
        Logger.error("[Token] get_es256_signer failed: #{inspect(error)}")
        error
    end
  end

  defp get_or_build_es256_signer do
    case :persistent_term.get({__MODULE__, :es256_signer}, nil) do
      nil    -> build_and_cache_es256_signer()
      signer -> {:ok, signer}
    end
  end

  defp build_and_cache_es256_signer do
    x = System.get_env("SUPABASE_EC_X")
    y = System.get_env("SUPABASE_EC_Y")

    Logger.debug("[Token] Building ES256 signer | ec_x_loaded=#{not is_nil(x) and x != ""}")

    cond do
      is_nil(x) or x == "" ->
        Logger.error("[Token] SUPABASE_EC_X is missing or empty!")
        {:error, :missing_supabase_ec_x}

      is_nil(y) or y == "" ->
        Logger.error("[Token] SUPABASE_EC_Y is missing or empty!")
        {:error, :missing_supabase_ec_y}

      true ->
        jwk = %{
          "kty" => "EC",
          "crv" => "P-256",
          "use" => "sig",
          "alg" => "ES256",
          "x"   => x,
          "y"   => y
        }

        signer = Joken.Signer.create("ES256", jwk)
        :persistent_term.put({__MODULE__, :es256_signer}, signer)
        Logger.debug("[Token] ES256 signer built and cached successfully")
        {:ok, signer}
    end
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  # Peek at the JWT header WITHOUT verifying the signature to read the `alg` field.
  defp peek_alg(token) do
    with [header_b64 | _]           <- String.split(token, "."),
         {:ok, header_json}         <- Base.url_decode64(header_b64, padding: false),
         {:ok, %{"alg" => alg}}     <- Jason.decode(header_json) do
      alg
    else
      _ -> "HS256"  # safe fallback to legacy
    end
  end
end
