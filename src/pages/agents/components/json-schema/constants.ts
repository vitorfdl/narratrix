import {
    Braces,
    Hash,
    List,
    ToggleLeft,
    Type,
} from "lucide-react"

export const SCHEMA_TYPES = [
  { value: "string", label: "Text", icon: Type },
  { value: "number", label: "Number", icon: Hash },
  { value: "integer", label: "Integer", icon: Hash },
  { value: "boolean", label: "Boolean", icon: ToggleLeft },
  { value: "array", label: "Array", icon: List },
  { value: "object", label: "Object", icon: Braces },
]

export const STRING_FORMATS = ["date", "date-time", "time", "email", "uri", "uuid", "ipv4", "ipv6"] 