defmodule NxtVibes.Workers.PushNotificationWorker do
  use Oban.Worker, queue: :default, max_attempts: 3
  require Logger
  alias NxtVibes.Accounts

  @impl Oban.Worker
  def perform(%Oban.Job{args: args}) do
    chat_id = args["chat_id"]
    chat_type = args["chat_type"]
    _sender_id = args["sender_id"]
    recipient_id = args["recipient_id"]
    sender_name = args["sender_name"] || "Someone"
    group_name = args["group_name"]
    message_type = args["message_type"] || "text"
    raw_preview = args["message_preview"] || "Sent a message"
    message_id = args["message_id"] || Ecto.UUID.generate()

    message_preview =
      case message_type do
        "image" -> "📷 Photo"
        "location" -> "📍 Location"
        "trip_share" -> "🧳 Shared a trip"
        "system" -> raw_preview
        _ -> raw_preview
      end

    # Fetch push tokens for recipient
    tokens = Accounts.list_push_tokens_for_user(recipient_id)

    if Enum.empty?(tokens) do
      Logger.debug("No push tokens found for recipient #{recipient_id}, skipping.")
      :ok
    else
      case System.get_env("FIREBASE_SERVICE_ACCOUNT_JSON") do
        nil ->
          Logger.error("FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set!")
          {:error, :missing_firebase_config}

        "" ->
          Logger.error("FIREBASE_SERVICE_ACCOUNT_JSON is empty!")
          {:error, :missing_firebase_config}

        json_str ->
          case Jason.decode(json_str) do
            {:ok, service_account} ->
              send_push_notifications(service_account, tokens, chat_id, chat_type, sender_name, group_name, message_preview, message_id)

            {:error, err} ->
              Logger.error("Failed to decode FIREBASE_SERVICE_ACCOUNT_JSON: #{inspect(err)}")
              {:error, :invalid_firebase_json}
          end
      end
    end
  end

  defp send_push_notifications(service_account, tokens, chat_id, chat_type, sender_name, group_name, message_preview, message_id) do
    preview =
      if String.length(message_preview) > 100 do
        String.slice(message_preview, 0, 100) <> "…"
      else
        message_preview
      end

    title =
      cond do
        chat_type == "trip_started" ->
          "🎉 Your itinerary starts today!"

        chat_type == "group" ->
          "#{sender_name} in #{group_name || "Group"}"

        true ->
          sender_name
      end

    deep_link_params =
      if chat_type == "trip_started" do
        Jason.encode!(%{
          "id" => chat_id
        })
      else
        Jason.encode!(%{
          "id" => chat_id,
          "chatId" => chat_id,
          "isGroupChat" => to_string(chat_type == "group"),
          "collectionName" => if(chat_type == "group", do: "group_chats", else: "direct_chats")
        })
      end

    case get_fcm_access_token(service_account) do
      {:ok, access_token} ->
        project_id = service_account["project_id"]

        Enum.each(tokens, fn token_row ->
          fcm_url = "https://fcm.googleapis.com/v1/projects/#{project_id}/messages:send"
          body = %{
            "message" => %{
              "token" => token_row.token,
              "android" => %{
                "priority" => "high"
              },
              "data" => %{
                "title" => title,
                "body" => preview,
                "deepLinkRoute" => "/chat/[id]",
                "deepLinkParams" => deep_link_params,
                "channelId" => "chat_messages",
                "messageId" => message_id
              }
            }
          }

          case Req.post(fcm_url, json: body, headers: [{"Authorization", "Bearer #{access_token}"}]) do
            {:ok, %Req.Response{status: status, body: _resp_body}} when status in 200..299 ->
              Logger.info("Successfully sent push notification to token: #{String.slice(token_row.token, 0..15)}...")

            {:ok, %Req.Response{status: status, body: resp_body}} ->
              resp_str = inspect(resp_body)
              Logger.warning("FCM send failed with status #{status}: #{resp_str}")

              if status == 404 or String.contains?(resp_str, "UNREGISTERED") or String.contains?(resp_str, "NOT_FOUND") do
                Logger.info("Removing stale FCM token: #{String.slice(token_row.token, 0..15)}...")
                Accounts.delete_push_token(token_row.token)
              end

            {:error, err} ->
              Logger.error("Failed to send push notification to token: #{inspect(err)}")
          end
        end)

        :ok

      {:error, reason} ->
        Logger.error("Failed to fetch FCM Google access token: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp get_fcm_access_token(service_account) do
    client_email = service_account["client_email"]
    private_key_pem = service_account["private_key"]

    now = System.system_time(:second)
    header = %{"alg" => "RS256", "typ" => "JWT"}
    payload = %{
      "iss" => client_email,
      "scope" => "https://www.googleapis.com/auth/firebase.messaging",
      "aud" => "https://oauth2.googleapis.com/token",
      "iat" => now,
      "exp" => now + 3600
    }

    encode = fn term ->
      term
      |> Jason.encode!()
      |> Base.url_encode64(padding: false)
    end

    unsigned_token = "#{encode.(header)}.#{encode.(payload)}"

    try do
      [pem_entry] = :public_key.pem_decode(private_key_pem)
      private_key = :public_key.pem_entry_decode(pem_entry)
      signature = :public_key.sign(unsigned_token, :sha256, private_key)
      signed_token = "#{unsigned_token}.#{Base.url_encode64(signature, padding: false)}"

      case Req.post("https://oauth2.googleapis.com/token",
        form: [
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: signed_token
        ]
      ) do
        {:ok, %Req.Response{status: 200, body: %{"access_token" => token}}} ->
          {:ok, token}

        {:ok, %Req.Response{status: status, body: body}} ->
          {:error, {:oauth_failed, status, body}}

        {:error, err} ->
          {:error, err}
      end
    rescue
      err ->
        {:error, {:key_decoding_failed, inspect(err)}}
    end
  end
end
