import axios from "axios";

const featchFileByffer = async (url: string, headerOption?: {}) => {
    const response = await axios.get(url, {
        ...headerOption,
        responseType: "arraybuffer",
      });

    if(response.status == 200) {
        return response.data.toString("base64");
    }
}

export {
    featchFileByffer
}