import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, type Relation } from "typeorm";
import { Inquiry } from "./Inquiry";
import { User } from "./User";

export enum InquiryDeliveryStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
}

@Entity("inquiry_recipients")
@Unique(["inquiryId", "managerId"])
@Index(["managerId"])
export class InquiryRecipient {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) inquiryId!: string;
  @ManyToOne(() => Inquiry, (inquiry) => inquiry.recipients, { onDelete: "CASCADE" })
  @JoinColumn({ name: "inquiryId" })
  inquiry!: Relation<Inquiry>;
  @Column({ type: "uuid" }) managerId!: string;
  @ManyToOne(() => User, { onDelete: "RESTRICT" }) @JoinColumn({ name: "managerId" }) manager!: Relation<User>;
  @Column({ type: "enum", enum: InquiryDeliveryStatus, default: InquiryDeliveryStatus.PENDING })
  deliveryStatus!: InquiryDeliveryStatus;
  @Column({ type: "varchar", length: 500, nullable: true }) deliveryError!: string | null;
  @Column({ type: "timestamptz", nullable: true }) notifiedAt!: Date | null;
  @Column({ type: "timestamptz", nullable: true }) readAt!: Date | null;
}
