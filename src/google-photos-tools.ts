import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  createPickerSession,
  deletePickerSession,
  getPickerSession,
  listPickedMediaItems,
} from "./google-photos.js";

const SessionInput = z.object({
  sessionId: z.string().min(1),
});

const ListInput = SessionInput.extend({
  pageSize: z.number().int().min(1).max(100).default(100),
  pageToken: z.string().optional(),
});

export const GooglePhotosTools = [
  {
    name: "google_photos_create_picker_session",
    description:
      "Create a Google Photos Picker session and return the picker URI. The user must open the URI and choose photos/videos before selected media can be listed.",
    inputSchema: zodToJsonSchema(z.object({})),
    async execute() {
      const session = await createPickerSession();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                sessionId: session.id,
                pickerUri: session.pickerUri,
                nextStep:
                  "Open pickerUri, select media, tap Done, then call google_photos_get_picker_session until mediaItemsSet is true.",
              },
              null,
              2
            ),
          },
        ],
        structuredContent: session,
      };
    },
  },
  {
    name: "google_photos_get_picker_session",
    description:
      "Get the status of a Google Photos Picker session, including whether the user has finished selecting media and any recommended polling configuration.",
    inputSchema: zodToJsonSchema(SessionInput),
    async execute({ sessionId }: { sessionId: string }) {
      const session = await getPickerSession(sessionId);
      return {
        content: [{ type: "text", text: JSON.stringify(session, null, 2) }],
        structuredContent: session,
      };
    },
  },
  {
    name: "google_photos_list_selected_media",
    description:
      "List media items explicitly selected by the user in a completed Google Photos Picker session. Supports pagination.",
    inputSchema: zodToJsonSchema(ListInput),
    async execute({
      sessionId,
      pageSize,
      pageToken,
    }: {
      sessionId: string;
      pageSize?: number;
      pageToken?: string;
    }) {
      const result = await listPickedMediaItems(sessionId, pageSize, pageToken);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      };
    },
  },
  {
    name: "google_photos_delete_picker_session",
    description:
      "Delete a Google Photos Picker session after its selected media has been processed or when the session is no longer needed.",
    inputSchema: zodToJsonSchema(SessionInput),
    async execute({ sessionId }: { sessionId: string }) {
      await deletePickerSession(sessionId);
      const result = { sessionId, deleted: true };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  },
];
