defmodule NxtVibes.Auth.Token do
  use Joken.Config

  @impl true
  def token_config do
    default_claims()
    |> add_claim("aud", nil, &(&1 == "authenticated"))
  end

  @doc """
  Verifies a Supabase JWT token.
  Returns `{:ok, claims}` or `{:error, reason}`.
  """
  def verify_token(token) do
    jwt_secret = System.get_env("SUPABASE_JWT_SECRET")

    if is_nil(jwt_secret) or jwt_secret == "" do
      {:error, :missing_jwt_secret}
    else
      signer = Joken.Signer.create("HS256", jwt_secret)
      verify_and_validate(token, signer)
    end
  end
end
