/**
 * @returns Whether the input string represents a 'thruthy' value ('1' or 'true').
 */
export default function parseBool(input: string | null | undefined) {
  return input ? Boolean(JSON.parse(input)) : false;
}
