const p = new Promise((resolve, reject) => {
    reject(new Error("fetch error"));
});

p.catch((err) => {
    throw new Error("addLog error");
}).finally(() => {
    console.log("finally executed!");
});
