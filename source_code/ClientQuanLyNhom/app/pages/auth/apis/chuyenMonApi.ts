import api from "../../../apis/api";

export interface ChuyenMon {
  chuyenMonId: number;
  tenChuyenMon: string;
}

export const getChuyenMonList = async (): Promise<ChuyenMon[]> => {
  try {
    const response = await api.get("/Auth/chuyen-mon");
    if (response.data.success) {
      return response.data.data;
    }
    return [];
  } catch (error) {
    console.error("Error fetching specializations:", error);
    return [];
  }
};
