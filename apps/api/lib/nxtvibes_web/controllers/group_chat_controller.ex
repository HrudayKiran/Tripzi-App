defmodule NxtVibesWeb.GroupChatController do
  use NxtVibesWeb, :controller

  alias NxtVibes.Chats
  alias NxtVibes.Chats.GroupChat
  alias NxtVibes.Accounts
  alias NxtVibes.Accounts.PublicProfile

  # Helper to resolve displayName or fallback
  defp get_display_name(uid, fallback) do
    case Accounts.get_public_profile(uid) do
      %PublicProfile{display_name: name} -> name || fallback
      _ -> fallback
    end
  end

  # Cast a list of possibly-binary UUIDs (from Postgres UUID[] columns) to UUID strings.
  defp cast_uuids(nil), do: []
  defp cast_uuids(list) when is_list(list) do
    Enum.map(list, fn
      bin when is_binary(bin) and byte_size(bin) == 16 -> Ecto.UUID.cast!(bin)
      str -> str
    end)
  end

  # Helper to broadcast updates to channels
  defp broadcast_group_update(chat, event_type) do
    payload = %{
      "chat_id" => chat.id,
      "event" => event_type,
      "group_chat" => %{
        "id" => chat.id,
        "group_name" => chat.group_name,
        "group_icon" => chat.group_icon,
        "participants" => chat.participants,
        "admins" => chat.admins,
        "member_count" => chat.member_count
      }
    }

    # Broadcast to the specific group chat channel
    NxtVibesWeb.Endpoint.broadcast("group:#{chat.id}", "group_updated", payload)

    # Broadcast to "user:#{user_id}" channel for each participant so their chat list updates
    Enum.each(chat.participants || [], fn user_id ->
      NxtVibesWeb.Endpoint.broadcast("user:#{user_id}", "chat_list_updated", %{
        "chat_id" => chat.id,
        "chat_type" => "group"
      })
    end)
  end

  @doc """
  POST /api/groups/create
  Body: %{"group_name" => name, "participants" => [uid,...], "group_icon" => url, "participant_details" => map}
  Creates a group chat + initial system message + broadcasts to all members.
  """
  def create_group(conn, params) do
    caller_uid = conn.assigns.current_user_id
    group_name = params["group_name"] || "Group"
    group_icon = params["group_icon"]
    raw_participants = params["participants"] || []
    participant_details = params["participant_details"] || %{}

    # Ensure caller is in participants
    participants = (raw_participants ++ [caller_uid]) |> Enum.uniq()

    unread_count =
      Enum.reduce(participants, %{}, fn uid, acc -> Map.put(acc, uid, 0) end)

    creator_name = get_display_name(caller_uid, "User")
    system_text = "#{creator_name} created the group \"#{group_name}\""

    chat_attrs = %{
      group_name: group_name,
      group_icon: group_icon,
      participants: participants,
      participant_details: participant_details,
      created_by: caller_uid,
      admins: [caller_uid],
      member_count: length(participants),
      unread_count: unread_count,
      last_message: %{
        "text" => system_text,
        "sender_id" => nil,
        "created_at" => DateTime.utc_now() |> DateTime.to_iso8601()
      }
    }

    case Chats.create_group_chat(chat_attrs) do
      {:ok, chat} ->
        # Add system message
        Chats.add_system_message(chat.id, system_text)

        # Broadcast to all participants
        broadcast_group_update(chat, "group_created")

        json(conn, %{success: true, chat_id: chat.id})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "Failed to create group.", details: inspect(changeset.errors)})
    end
  end

  @doc """
  POST /api/group_chats/update-name
  Body: %{"chatId" => chat_id, "group_name" => name}
  """
  def update_name(conn, %{"chatId" => chat_id, "group_name" => group_name}) do
    caller_uid = conn.assigns.current_user_id

    case Chats.get_group_chat(chat_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Chat not found."})

      %NxtVibes.Chats.GroupChat{} = chat ->
        admins = chat.admins || []

        if chat.created_by == caller_uid or caller_uid in admins do
          actor_name = get_display_name(caller_uid, "Admin")
          system_text = "#{actor_name} changed the group name to \"#{group_name}\""

          case Chats.update_group_chat(chat, %{group_name: group_name}) do
            {:ok, updated_chat} ->
              Chats.add_system_message(chat_id, system_text)
              broadcast_group_update(updated_chat, "name_updated")
              json(conn, %{success: true})

            {:error, _} ->
              conn |> put_status(:unprocessable_entity) |> json(%{error: "Failed to update name."})
          end
        else
          conn |> put_status(:forbidden) |> json(%{error: "Only admins can update the group name."})
        end
    end
  end

  @doc """
  POST /api/group_chats/update-icon
  Body: %{"chatId" => chat_id, "group_icon" => url}
  """
  def update_icon(conn, %{"chatId" => chat_id, "group_icon" => group_icon}) do
    caller_uid = conn.assigns.current_user_id

    case Chats.get_group_chat(chat_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Chat not found."})

      %NxtVibes.Chats.GroupChat{} = chat ->
        admins = chat.admins || []

        if chat.created_by == caller_uid or caller_uid in admins do
          actor_name = get_display_name(caller_uid, "Admin")
          system_text = "#{actor_name} changed this group's icon"

          case Chats.update_group_chat(chat, %{group_icon: group_icon}) do
            {:ok, updated_chat} ->
              Chats.add_system_message(chat_id, system_text)
              broadcast_group_update(updated_chat, "icon_updated")
              json(conn, %{success: true})

            {:error, _} ->
              conn |> put_status(:unprocessable_entity) |> json(%{error: "Failed to update icon."})
          end
        else
          conn |> put_status(:forbidden) |> json(%{error: "Only admins can update the group icon."})
        end
    end
  end
  @doc """
  POST /api/group_chats/add-member
  Body: %{"chatId" => chat_id, "memberId" => member_id}
  """
  def add_member(conn, %{"chatId" => chat_id, "memberId" => member_id}) do
    caller_uid = conn.assigns.current_user_id

    case Chats.get_group_chat(chat_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Chat not found."})

      %GroupChat{} = chat ->
        admins = cast_uuids(chat.admins)
        participants = cast_uuids(chat.participants)

        # Auth check: caller must be creator or admin
        if chat.created_by == caller_uid or caller_uid in admins do
          if member_id in participants do
            json(conn, %{success: true, skipped: "already_member"})
          else
            new_participants = participants ++ [member_id]
            actor_name = get_display_name(caller_uid, "Admin")
            member_name = get_display_name(member_id, "someone")

            update_attrs = %{
              participants: new_participants,
              member_count: length(new_participants)
            }

            case Chats.update_group_chat(chat, update_attrs) do
              {:ok, updated_chat} ->
                # Add system message
                system_text = "#{actor_name} added #{member_name}"
                Chats.add_system_message(chat_id, system_text)

                # Broadcast channel updates
                broadcast_group_update(updated_chat, "member_added")

                json(conn, %{success: true})

              {:error, _changeset} ->
                conn |> put_status(:unprocessable_entity) |> json(%{error: "Failed to add member."})
            end
          end
        else
          conn |> put_status(:forbidden) |> json(%{error: "Only the group creator or admins can add members."})
        end
    end
  end

  @doc """
  POST /api/group_chats/remove-member
  Body: %{"chatId" => chat_id, "memberId" => member_id}
  """
  def remove_member(conn, %{"chatId" => chat_id, "memberId" => member_id}) do
    caller_uid = conn.assigns.current_user_id

    if caller_uid == member_id do
      conn |> put_status(:bad_request) |> json(%{error: "Use leave endpoint."})
    else
      case Chats.get_group_chat(chat_id) do
        nil ->
          conn |> put_status(:not_found) |> json(%{error: "Chat not found."})

        %GroupChat{} = chat ->
          admins = cast_uuids(chat.admins)
          participants = cast_uuids(chat.participants)

          # Auth check: caller must be creator or admin
          if chat.created_by == caller_uid or caller_uid in admins do
            if member_id in participants do
              new_participants = List.delete(participants, member_id)
              # Also remove from admins if they were one
              new_admins = List.delete(admins, member_id)
              actor_name = get_display_name(caller_uid, "Admin")
              member_name = get_display_name(member_id, "someone")

              update_attrs = %{
                participants: new_participants,
                admins: new_admins,
                member_count: length(new_participants)
              }

              case Chats.update_group_chat(chat, update_attrs) do
                {:ok, updated_chat} ->
                  system_text = "#{actor_name} removed #{member_name}"
                  Chats.add_system_message(chat_id, system_text)

                  # Broadcast channel updates
                  broadcast_group_update(updated_chat, "member_removed")

                  # Notify the removed user on their personal channel that they were removed
                  NxtVibesWeb.Endpoint.broadcast("user:#{member_id}", "removed_from_group", %{
                    "chat_id" => chat_id
                  })

                  json(conn, %{success: true})

                {:error, _changeset} ->
                  conn |> put_status(:unprocessable_entity) |> json(%{error: "Failed to remove member."})
              end
            else
              json(conn, %{success: true, skipped: "not_member"})
            end
          else
            conn |> put_status(:forbidden) |> json(%{error: "Only the group creator or admins can remove members."})
          end
      end
    end
  end

  @doc """
  POST /api/group_chats/leave
  Body: %{"chatId" => chat_id}
  """
  def leave(conn, %{"chatId" => chat_id}) do
    caller_uid = conn.assigns.current_user_id

    case Chats.get_group_chat(chat_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Chat not found."})

      %GroupChat{} = chat ->
        participants = cast_uuids(chat.participants)
        admins = cast_uuids(chat.admins)

        if chat.created_by == caller_uid do
          conn |> put_status(:bad_request) |> json(%{error: "Creator cannot leave without transferring ownership."})
        else
          if caller_uid in participants do
            new_participants = List.delete(participants, caller_uid)
            new_admins = List.delete(admins, caller_uid)
            actor_name = get_display_name(caller_uid, "User")

            update_attrs = %{
              participants: new_participants,
              admins: new_admins,
              member_count: length(new_participants)
            }

            case Chats.update_group_chat(chat, update_attrs) do
              {:ok, updated_chat} ->
                system_text = "#{actor_name} left the group"
                Chats.add_system_message(chat_id, system_text)

                # Broadcast channel updates (to remaining participants)
                broadcast_group_update(updated_chat, "member_left")

                # Notify the leaving user on their channel to clear from screen/list
                NxtVibesWeb.Endpoint.broadcast("user:#{caller_uid}", "left_group", %{
                  "chat_id" => chat_id
                })

                json(conn, %{success: true})

              {:error, _changeset} ->
                conn |> put_status(:unprocessable_entity) |> json(%{error: "Failed to leave group."})
            end
          else
            json(conn, %{success: true, skipped: "not_member"})
          end
        end
    end
  end

  @doc """
  POST /api/group_chats/promote-admin
  Body: %{"chatId" => chat_id, "memberId" => member_id}
  """
  def promote_admin(conn, %{"chatId" => chat_id, "memberId" => member_id}) do
    caller_uid = conn.assigns.current_user_id

    case Chats.get_group_chat(chat_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Chat not found."})

      %GroupChat{} = chat ->
        admins = cast_uuids(chat.admins)
        participants = cast_uuids(chat.participants)

        # Only group creator can promote
        if chat.created_by == caller_uid do
          if member_id in participants do
            if member_id in admins do
              json(conn, %{success: true, skipped: "already_admin"})
            else
              new_admins = admins ++ [member_id]
              actor_name = get_display_name(caller_uid, "Admin")
              member_name = get_display_name(member_id, "someone")

              case Chats.update_group_chat(chat, %{admins: new_admins}) do
                {:ok, updated_chat} ->
                  system_text = "#{actor_name} made #{member_name} an admin"
                  Chats.add_system_message(chat_id, system_text)

                  # Broadcast channel updates
                  broadcast_group_update(updated_chat, "admin_promoted")

                  json(conn, %{success: true})

                {:error, _changeset} ->
                  conn |> put_status(:unprocessable_entity) |> json(%{error: "Failed to promote member."})
              end
            end
          else
            conn |> put_status(:bad_request) |> json(%{error: "Not a participant."})
          end
        else
          conn |> put_status(:forbidden) |> json(%{error: "Only creator can promote."})
        end
    end
  end

  @doc """
  POST /api/group_chats/demote-admin
  Body: %{"chatId" => chat_id, "memberId" => member_id}
  """
  def demote_admin(conn, %{"chatId" => chat_id, "memberId" => member_id}) do
    caller_uid = conn.assigns.current_user_id

    case Chats.get_group_chat(chat_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Chat not found."})

      %GroupChat{} = chat ->
        admins = chat.admins || []

        # Only group creator can demote
        if chat.created_by == caller_uid do
          if member_id in admins do
            new_admins = List.delete(admins, member_id)
            actor_name = get_display_name(caller_uid, "Admin")
            member_name = get_display_name(member_id, "someone")

            case Chats.update_group_chat(chat, %{admins: new_admins}) do
              {:ok, updated_chat} ->
                system_text = "#{actor_name} removed #{member_name} as admin"
                Chats.add_system_message(chat_id, system_text)

                # Broadcast channel updates
                broadcast_group_update(updated_chat, "admin_demoted")

                json(conn, %{success: true})

              {:error, _changeset} ->
                conn |> put_status(:unprocessable_entity) |> json(%{error: "Failed to demote member."})
            end
          else
            json(conn, %{success: true, skipped: "not_admin"})
          end
        else
          conn |> put_status(:forbidden) |> json(%{error: "Only creator can demote."})
        end
    end
  end
end
