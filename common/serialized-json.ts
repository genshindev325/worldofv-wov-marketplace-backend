import { SerializedJson } from '@generated/ts-proto/types/serialized_json';

// Standard wrappers (e.g. google.protobuf.Any, google.protobuf.Struct, etc...)
// don't serialize correctly with the default NestJS proto loader, so if we need
// to send arbitrary data through RPC we just serialize it into a JSON string.
//
// See https://github.com/stephenh/ts-proto/issues/69

export function encodeSerializedJson<T = any>(value: T): SerializedJson {
  return { data: JSON.stringify(value) };
}

export function decodeSerializedJson<T = any>(value: SerializedJson): T {
  return JSON.parse(value.data);
}
