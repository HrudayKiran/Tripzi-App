defmodule NxtVibesWeb.GroupChatChannel do
  use NxtVibesWeb, :channel
  alias NxtVibes.Chats
  alias NxtVibes.Chats.GroupChat
  alias NxtVibesWeb.Presence

  @impl true
  def join("group:" <> chat_id, _params, socket) do
    user_id = socket.assigns.current_user_id

    case Chats.get_group_chat(chat_id) do
      %GroupChat{participants: participants} = _chat ->
        if user_id in (participants || []) do
          send(self(), :after_join)
          {:ok, assign(socket, :chat_id, chat_id)}
        else
          {:error, %{reason: "unauthorized"}}
        end

      nil ->
        {:error, %{reason: "not_found"}}
    end
  end

  @impl true
  def handle_info(:after_join, socket) do
    # Track online presence in the chat room
    {:ok, _} = Presence.track(socket, socket.assigns.current_user_id, %{
      online_at: System.system_time(:second)
    })
    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end

  # JSON payload helper for messages
  defp map_message_payload(m) do
    %{
      "id" => m.id,
      "chat_id" => m.chat_id,
      "chat_type" => m.chat_type,
      "sender_id" => m.sender_id,
      "sender_name" => m.sender_name,
      "type" => m.type,
      "text" => m.text,
      "media_url" => m.media_url,
      "location" => m.location,
      "voice_duration" => if(m.voice_duration, do: Decimal.to_float(m.voice_duration), else: nil),
      "reply_to" => m.reply_to,
      "status" => m.status,
      "read_by" => m.read_by,
      "delivered_to" => m.delivered_to,
      "edited_at" => if(m.edited_at, do: DateTime.to_unix(m.edited_at, :millisecond), else: nil),
      "deleted_for" => m.deleted_for,
      "deleted_for_everyone_at" => if(m.deleted_for_everyone_at, do: DateTime.to_unix(m.deleted_for_everyone_at, :millisecond), else: nil),
      "mentions" => m.mentions,
      "created_at" => DateTime.to_unix(m.created_at, :millisecond),
      "updated_at" => DateTime.to_unix(m.updated_at, :millisecond)
    }
  end

  @impl true
  def handle_in("send_message", params, socket) do
    user_id = socket.assigns.current_user_id
    chat_id = socket.assigns.chat_id

    message_attrs =
      params
      |> Map.put("chat_id", chat_id)
      |> Map.put("chat_type", "group")
      |> Map.put("sender_id", user_id)
      |> Map.put("status", "sent")

    case Chats.create_message(message_attrs) do
      {:ok, message} ->
        mapped = map_message_payload(message)
        broadcast!(socket, "new_message", mapped)

        # Enqueue Push Notification job via Oban for each other participant
        case Chats.get_group_chat(chat_id) do
          %GroupChat{participants: participants, group_name: group_name} ->
            recipients = Enum.filter(participants || [], &(&1 != user_id))

            # Trigger push job for each recipient
            if Code.ensure_loaded?(Oban) do
              Enum.each(recipients, fn recipient_id ->
                %{
                  chat_id: chat_id,
                  chat_type: "group",
                  sender_id: user_id,
                  recipient_id: recipient_id,
                  sender_name: message.sender_name || "Someone",
                  group_name: group_name || "Group",
                  message_preview: message.text || "Sent a message"
                }
                |> NxtVibes.Workers.PushNotificationWorker.new()
                |> Oban.insert()
              end)
            end
          _ -> :ok
        end

        {:reply, {:ok, mapped}, socket}

      {:error, changeset} ->
        {:reply, {:error, %{errors: inspect(changeset.errors)}}, socket}
    end
  end

  @impl true
  def handle_in("typing_start", _params, socket) do
    broadcast_from!(socket, "user_typing", %{
      "user_id" => socket.assigns.current_user_id,
      "typing" => true
    })
    {:noreply, socket}
  end

  @impl true
  def handle_in("typing_stop", _params, socket) do
    broadcast_from!(socket, "user_typing", %{
      "user_id" => socket.assigns.current_user_id,
      "typing" => false
    })
    {:noreply, socket}
  end

  @impl true
  def handle_in("mark_read", %{"message_ids" => message_ids}, socket) do
    # Broadcast to all users in room that messages are read
    broadcast!(socket, "messages_read", %{
      "user_id" => socket.assigns.current_user_id,
      "message_ids" => message_ids
    })
    {:reply, :ok, socket}
  end

  @impl true
  def handle_in("edit_message", %{"message_id" => msg_id, "text" => new_text}, socket) do
    case Chats.get_message(msg_id) do
      nil -> {:reply, {:error, %{reason: "not_found"}}, socket}
      msg ->
        case Chats.update_message(msg, %{text: new_text, edited_at: DateTime.utc_now()}) do
          {:ok, updated} ->
            broadcast!(socket, "message_edited", %{
              "message_id" => msg_id,
              "text" => new_text,
              "edited_at" => DateTime.to_unix(DateTime.utc_now(), :millisecond)
            })
            {:reply, {:ok, map_message_payload(updated)}, socket}
          {:error, err} ->
            {:reply, {:error, %{reason: inspect(err)}}, socket}
        end
    end
  end

  @impl true
  def handle_in("delete_message", %{"message_id" => msg_id, "everyone" => true}, socket) do
    case Chats.get_message(msg_id) do
      nil -> {:reply, {:error, %{reason: "not_found"}}, socket}
      msg ->
        case Chats.update_message(msg, %{deleted_for_everyone_at: DateTime.utc_now()}) do
          {:ok, _updated} ->
            broadcast!(socket, "message_deleted", %{
              "message_id" => msg_id,
              "everyone" => true,
              "deleted_at" => DateTime.to_unix(DateTime.utc_now(), :millisecond)
            })
            {:reply, :ok, socket}
          {:error, err} ->
            {:reply, {:error, %{reason: inspect(err)}}, socket}
        end
    end
  end
end
