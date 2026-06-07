/**
 * FlowOS - src/models/kycRequest.model.ts
 * Business verification (KYC) request. Model defined now; endpoints are deferred
 * (KYC is not part of the current module implementation order).
 * Collection: kycRequests
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const kycDocumentSchema = new Schema(
  {
    type: { type: String, required: true }, // e.g. "BUSINESS_LICENSE", "ID_PROOF"
    url: { type: String, required: true },
  },
  { _id: false },
);

const kycRequestSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    documents: { type: [kycDocumentSchema], default: [] },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String },
  },
  { timestamps: true },
);

export type KycRequestDoc = HydratedDocument<InferSchemaType<typeof kycRequestSchema>>;
export const KycRequest = model('KycRequest', kycRequestSchema, 'kycRequests');
