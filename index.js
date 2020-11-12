const xlsx = require("xlsx");
const axios = require("axios").default;

axios.defaults.baseURL = "https://shop.mango.com/services/garments/";
axios.interceptors.request.use((config) => {
  config.headers["stock-id"] = "690.IN.0.false.false.v0";
  return config;
});

const workbook = xlsx.readFile("./data.xlsx");

const mangoData = xlsx.utils.sheet_to_json(
  workbook.Sheets[workbook.SheetNames[0]]
);

const extractImg = (res, colorId) => {
  const colors = res.colors.colors;
  const color = colors.find((e) => e.id == colorId);

  if (!color) {
    throw new Error(`${colorId} not found in ${res.id}`);
  }

  const images = color.images;

  const mergedImages = images.reduce((acc, cur) => {
    return [...acc, ...cur];
  }, []);

  return {
    "Image 1": `https://st.mngbcn.com/rcs/pics/static${mergedImages[0].url}`,
    "Image 2": `https://st.mngbcn.com/rcs/pics/static${mergedImages[1].url}`,
    "Image 3": `https://st.mngbcn.com/rcs/pics/static${mergedImages[2].url}`,
  };
};

const getImg = async (o) => {
  try {
    const id = o["STYLE CODE"];
    const color = o["COLOR CODE"];
    // load from cache
    if (cache.get(id)) {
      return {
        ...o,
        ...extractImg(cache.get(id), color),
      };
    }

    // call api instead;
    const res = await (await axios.get(`${id}`)).data;
    // console.log(res)
    cache.setCache(o.id, res);

    return {
      ...o,
      ...extractImg(res, color),
    };
  } catch (error) {
    console.log(`error ${o["STYLE CODE"]}`);
    return o;
  }
};

const createCache = (origin) => {
  const valueSym = Symbol("value");

  return Object.freeze({
    [valueSym]: origin
      .reduce((acc, cur) => {
        const id = cur["STYLE CODE"];

        const idx = acc.findIndex((e) => e.id === id);
        if (idx >= 0) {
          acc[idx].count = acc[idx].count + 1;
          return acc;
        }
        acc.push({
          id,
          count: 1,
        });

        return acc;
      }, [])
      .filter((e) => e.count > 1)
      .reduce((acc, cur) => {
        acc[cur.id] = {
          count: cur.count,
        };
        return acc;
      }, {}),

    setCache(id, val) {
      if (this[valueSym][id] && !this._value[id].val) {
        this._value[id].val = val;
      }
    },

    get(id) {
      return this[valueSym][id]?.val;
    },
  });
};

// APP
const cache = createCache(mangoData);

const handler = mangoData.map((e) => getImg(e));

Promise.all(handler).then((val) => {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(val);
  xlsx.utils.book_append_sheet(wb, ws);

  xlsx.writeFile(wb, "out");
});
