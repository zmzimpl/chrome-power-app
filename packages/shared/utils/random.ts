export function randomUniqueProfileId(length = 7) {
  let result = '';
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}

export function randomASCII() {
  const min = 32;
  const max = 126;

  const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;

  return String.fromCharCode(randomNum);
}

export function randomFloat() {
  return Math.random() / 2;
}

export function randomInt() {
  return Math.floor(Math.random() * 99);
}
