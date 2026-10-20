export type ActionResult<Fields extends string> =
  | { success: true }
  | {
      success: false
      message: string
      fieldErrors?: Partial<Record<Fields, string[]>>
    }
