import type { ApiResponse, MediaAsset } from "./types"

// Placeholder: fetch media asset info
export async function getMediaInfo(id: string): Promise<ApiResponse<MediaAsset>> {
    return {
        data: {
            id,
            url: `/media/${id}`,
            contentType: "image/jpeg"
        }
    }
}
