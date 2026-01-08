import type { AxiosInstance } from "axios";
import axios from "axios";
import type { SendTextMessageRequest } from "./types";

export class UazapiApi {
  private baseUrl: string;
  private adminToken: string;
  private instanceToken?: string;

  private axios: AxiosInstance;

  constructor({
    baseUrl,
    adminToken,
    instanceToken,
  }: {
    baseUrl: string;
    adminToken: string;
    instanceToken?: string;
  }) {
    if (!baseUrl || !adminToken) {
      throw new Error("Invalid UAZAPI credentials");
    }

    this.baseUrl = baseUrl;
    this.adminToken = adminToken;

    if (instanceToken) {
      this.instanceToken = instanceToken;
    }

    this.axios = axios.create({
      baseURL: this.baseUrl,
      headers: {
        admintoken: `${this.adminToken}`,
      },
    });
  }

  private needInstanceToken() {
    return (
      this.instanceToken === undefined ||
      this.instanceToken === "" ||
      this.instanceToken === null
    );
  }

  async sendTextMessage(request: SendTextMessageRequest): Promise<any> {
    if (this.needInstanceToken()) {
      throw new Error("Instance token is required");
    }

    try {
      const response = await this.axios.post("/send/text", request, {
        headers: {
          token: `${this.instanceToken}`,
        },
      });

      return {
        ...response.data,
        ok: response.status === 200,
      };
    } catch {
      return null;
    }
  }
}
