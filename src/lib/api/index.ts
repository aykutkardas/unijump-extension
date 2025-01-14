import { v4 as uuidv4 } from 'uuid';
import { Cache } from '$lib/decorators/cache.method';
import {
  CloudflareException,
  ServiceBusyException,
  UnauthorizedException,
  UnknownException,
} from '$lib/exceptions';
import { parseStream } from '$lib/sse';

export interface ConversationParams {
  text: string;
  conversationId?: string;
  parentMessageId?: string;
  messageId?: string;
}

export interface ConversationResponse {
  text: string;
  conversationId: string;
  messageId: string;
}

export interface ConversationProperty {
  is_visible: boolean;
  title: string;
}

export interface ApiSession {
  accessToken: string;
  expires: string;
  user: {
    id: string;
    name: string;
    picture: string;
  };
}

interface ConversationBody {
  conversation_id?: string;
  action: 'next';
  model: 'text-davinci-002-render';
  parent_message_id: string;
  messages: [ConversationMessage];
}

interface ConversationMessage {
  id: string;
  role: 'user';
  content: {
    content_type: 'text';
    parts: [string];
  };
}

type OnMessageCallback<T> = (message: T, done: boolean) => void;

export class Api {
  private abortController: AbortController;
  private baseUrl = 'https://chat.openai.com';

  private getFullUrl(path: string) {
    return `${this.baseUrl}${path}`;
  }

  private async fetch<Res>(
    path: string,
    options: RequestInit = {},
    onSseMessage?: OnMessageCallback<Res>
  ): Promise<void | Res> {
    this.abortController = new AbortController();
    const { accessToken } = await this.getSession();

    const requestOptions: RequestInit = {
      signal: this.abortController.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      ...options,
    };

    const response = await fetch(this.getFullUrl(path), requestOptions);

    if (!response.ok) {
      if (response.status === 403) {
        throw new CloudflareException();
      }

      if (response.status === 405) {
        throw new ServiceBusyException();
      }

      throw new UnknownException();
    }

    if (onSseMessage) {
      parseStream<Res>(response.body, '[DONE]', (message, done) => {
        onSseMessage(message, done);
      });
    } else {
      return response.json() as Res;
    }
  }

  private async post<T, K>(path: string, body: T, onSseMessage?: OnMessageCallback<K>) {
    const bodyString = JSON.stringify(body);

    return this.fetch(
      path,
      {
        body: bodyString,
        method: 'POST',
      },
      onSseMessage
    );
  }

  private patch<T>(path: string, body: T) {
    const bodyString = JSON.stringify(body);

    return this.fetch(path, {
      body: bodyString,
      method: 'PATCH',
    });
  }

  abortRequests() {
    this.abortController?.abort();
  }

  @Cache(1000 * 60) // 60 seconds
  async getSession(): Promise<ApiSession> {
    const response = await fetch(this.getFullUrl('/api/auth/session'));

    if (!response.ok) {
      if (response.status === 403) {
        throw new CloudflareException();
      }

      if (response.status === 405) {
        throw new ServiceBusyException();
      }

      throw new UnknownException();
    }

    const session = await response.json();

    if (!session.accessToken) {
      throw new UnauthorizedException();
    }

    return session;
  }

  setConversationProperty(conversationId: string, props: Partial<ConversationProperty>) {
    return this.patch(`/backend-api/conversation/${conversationId}`, props);
  }

  conversation(
    params: ConversationParams,
    onMessage: (message: ConversationResponse, done: boolean) => void
  ) {
    const conversationBody: ConversationBody = {
      action: 'next',
      model: 'text-davinci-002-render',
      parent_message_id: params.parentMessageId || uuidv4(),
      messages: [
        {
          id: uuidv4(),
          role: 'user',
          content: {
            content_type: 'text',
            parts: [params.text],
          },
        },
      ],
    };

    if (params.conversationId) {
      conversationBody.conversation_id = params.conversationId;
    }

    return this.post(
      '/backend-api/conversation',
      conversationBody,
      (payload: any, done: boolean) => {
        const message = payload?.message;

        if (!message) {
          onMessage(null, true);
          return;
        }

        const text = message.content?.parts?.[0];

        if (text) {
          onMessage(
            { text, messageId: message.id, conversationId: payload.conversation_id },
            done
          );
        }
      }
    );
  }
}

export default new Api();
