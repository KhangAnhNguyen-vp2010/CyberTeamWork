import api from "../../../apis/api";

type UpdateProfilePayload = {
  HoTen: string;
  GioiTinh: string;
  NgaySinh: string;
  MoTaBanThan: string;
  SoDienThoai: string;
  DiaChi: string;
  ChuyenMonId?: string;
};

export async function updateUserProfile(
  nguoiDungId: number,
  data: UpdateProfilePayload,
  anhBiaFile?: File | null
) {
  if (!nguoiDungId) {
    throw new Error("User ID is required");
  }

  const formData = new FormData();
  formData.append("HoTen", data.HoTen ?? "");
  formData.append("GioiTinh", data.GioiTinh ?? "");
  formData.append("NgaySinh", data.NgaySinh ?? "");
  formData.append("MoTaBanThan", data.MoTaBanThan ?? "");
  formData.append("SoDienThoai", data.SoDienThoai ?? "");
  formData.append("DiaChi", data.DiaChi ?? "");

  if (data.ChuyenMonId) {
    formData.append("ChuyenMonId", data.ChuyenMonId);
  }

  if (anhBiaFile) {
    formData.append("AnhBia", anhBiaFile);
  }

  console.log("Updating profile for user:", nguoiDungId);

  try {
    const res = await api.put(`/Auth/update-profile/${nguoiDungId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    console.log("Update response:", res.data);
    return res.data;
  } catch (error) {
    console.error("Error in updateUserProfile:", error);
    throw error;
  }
}
