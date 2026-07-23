import { NextRequest } from "next/server";
import { apiUser } from "@/lib/auth/authorize";
import { assertSameOrigin, fail, ok, parseBody } from "@/lib/http";
import { assertInquiryAccess, serializeInquiry, updateInquiry } from "@/lib/inquiries/service";
import { updateInquirySchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: Context) {
  try {
    return ok(serializeInquiry(await assertInquiryAccess(await apiUser(request), (await params).id)));
  } catch (error) {
    return fail(error);
  }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    assertSameOrigin(request);
    const actor = await apiUser(request);
    const input = await parseBody(request, updateInquirySchema);
    await updateInquiry(actor, (await params).id, input);
    return ok({ message: "Inquiry updated" });
  } catch (error) {
    return fail(error);
  }
}
