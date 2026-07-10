defmodule NxtVibes.Chats do
  import Ecto.Query, warn: false
  alias NxtVibes.Repo
  alias NxtVibes.Chats.DirectChat
  alias NxtVibes.Chats.GroupChat
  alias NxtVibes.Chats.Message

  # -----------------------------------------------------------------------------
  # Direct Chats Context
  # -----------------------------------------------------------------------------

  @doc """
  Gets a single direct chat by ID.
  """
  def get_direct_chat(id) do
    Repo.get(DirectChat, id)
  end

  @doc """
  Creates a direct chat.
  """
  def create_direct_chat(attrs \\ %{}) do
    %DirectChat{}
    |> DirectChat.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a direct chat.
  """
  def update_direct_chat(%DirectChat{} = direct_chat, attrs) do
    direct_chat
    |> DirectChat.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Lists direct chats for a user, optionally filtered by updated_since date.
  """
  def list_direct_chats_for_user(user_id, updated_since \\ nil) do
    {:ok, binary_user_id} = Ecto.UUID.dump(user_id)

    query =
      from c in DirectChat,
        where: fragment("? = ANY(?)", ^binary_user_id, c.participants)

    query =
      if updated_since do
        from c in query, where: c.updated_at > ^updated_since
      else
        query
      end

    Repo.all(query)
  end

  # -----------------------------------------------------------------------------
  # Group Chats Context
  # -----------------------------------------------------------------------------

  @doc """
  Gets a single group chat by ID.
  """
  def get_group_chat(id) do
    Repo.get(GroupChat, id)
  end

  @doc """
  Creates a group chat.
  """
  def create_group_chat(attrs \\ %{}) do
    %GroupChat{}
    |> GroupChat.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a group chat.
  """
  def update_group_chat(%GroupChat{} = group_chat, attrs) do
    group_chat
    |> GroupChat.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Lists group chats for a user, optionally filtered by updated_since date.
  """
  def list_group_chats_for_user(user_id, updated_since \\ nil) do
    {:ok, binary_user_id} = Ecto.UUID.dump(user_id)

    query =
      from c in GroupChat,
        where: fragment("? = ANY(?)", ^binary_user_id, c.participants)

    query =
      if updated_since do
        from c in query, where: c.updated_at > ^updated_since
      else
        query
      end

    Repo.all(query)
  end

  # -----------------------------------------------------------------------------
  # Messages Context
  # -----------------------------------------------------------------------------

  @doc """
  Gets a single message by ID.
  """
  def get_message(id) do
    Repo.get(Message, id)
  end

  @doc """
  Creates a message.
  """
  def create_message(attrs \\ %{}) do
    %Message{}
    |> Message.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a message.
  """
  def update_message(%Message{} = message, attrs) do
    message
    |> Message.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Lists messages for a list of chat IDs, optionally filtered by updated_since date.
  """
  def list_messages_for_chats(chat_ids, updated_since \\ nil) do
    query =
      from m in Message,
        where: m.chat_id in ^chat_ids

    query =
      if updated_since do
        from m in query, where: m.updated_at > ^updated_since
      else
        query
      end

    Repo.all(query)
  end

  @doc """
  Inserts a system message in the chat logs and updates last_message on the group chat.
  """
  def add_system_message(chat_id, text) do
    message_attrs = %{
      chat_id: chat_id,
      chat_type: "group",
      sender_id: "system",
      sender_name: "System",
      type: "system",
      text: text,
      status: "sent"
    }

    Repo.transaction(fn ->
      case create_message(message_attrs) do
        {:ok, _message} ->
          case get_group_chat(chat_id) do
            %GroupChat{} = group_chat ->
              now = DateTime.utc_now()
              update_attrs = %{
                last_message: %{
                  "text" => text,
                  "sender_id" => nil,
                  "created_at" => DateTime.to_iso8601(now)
                }
              }
              case update_group_chat(group_chat, update_attrs) do
                {:ok, updated_chat} -> updated_chat
                {:error, changeset} -> Repo.rollback(changeset)
              end

            nil -> Repo.rollback(:group_chat_not_found)
          end

        {:error, changeset} -> Repo.rollback(changeset)
      end
    end)
  end
end
