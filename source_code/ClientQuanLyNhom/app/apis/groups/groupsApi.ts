import api from "../api";

export interface Group {
  nhomId: number;
  tenNhom: string;
  soLuongTV: number; // Capitalized to match the API response
  ngayLapNhom: string;
  anhBia?: string;
  chucVu: string;
}

export const getGroupsByUser = async (userId: number): Promise<Group[]> => {
  try {
    const response = await api.get(`/Nhom/GetGroupsOfMember/${userId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching user groups:", error);
    throw error;
  }
};

export const getGroupDetails = async (groupId: number): Promise<Group> => {
  try {
    const response = await api.get(`/Nhom/${groupId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching group details:", error);
    throw error;
  }
};
