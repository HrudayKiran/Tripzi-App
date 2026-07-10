defmodule NxtVibesWeb.Presence do
  use Phoenix.Presence,
    otp_app: :nxtvibes,
    pubsub_server: NxtVibes.PubSub
end
