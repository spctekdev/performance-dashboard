import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from "typeorm";
import { User } from "./User";
import { Department } from "./Department";
import { InquiryRecipient } from "./InquiryRecipient";
import { InquiryMessage } from "./InquiryMessage";

export enum InquiryStatus {
  OPEN = "OPEN",
  ANSWERED = "ANSWERED",
  CLOSED = "CLOSED",
}
export enum InquiryReferenceType {
  GOAL = "GOAL",
  JOURNAL_ENTRY = "JOURNAL_ENTRY",
  KPI_DEFINITION = "KPI_DEFINITION",
  KPI_PERFORMANCE = "KPI_PERFORMANCE",
  KNOWLEDGE = "KNOWLEDGE",
  NONE = "NONE",
}

@Entity("inquiries")
@Index(["employeeId", "lastMessageAt"])
@Index(["departmentId", "status"])
export class Inquiry {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) employeeId!: string;
  @ManyToOne(() => User, { onDelete: "RESTRICT" }) @JoinColumn({ name: "employeeId" }) employee!: Relation<User>;
  @Column({ type: "uuid" }) departmentId!: string;
  @ManyToOne(() => Department, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "departmentId" })
  department!: Relation<Department>;
  @Column({ type: "varchar", length: 180 }) subject!: string;
  @Column({ type: "enum", enum: InquiryStatus, default: InquiryStatus.OPEN }) status!: InquiryStatus;
  @Column({ type: "enum", enum: InquiryReferenceType, default: InquiryReferenceType.NONE })
  referenceType!: InquiryReferenceType;
  @Column({ type: "uuid", nullable: true }) referenceId!: string | null;
  @Column({ type: "varchar", length: 240, nullable: true }) referenceLabel!: string | null;
  @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }) lastMessageAt!: Date;
  @OneToMany(() => InquiryRecipient, (recipient) => recipient.inquiry) recipients!: Relation<InquiryRecipient[]>;
  @OneToMany(() => InquiryMessage, (message) => message.inquiry) messages!: Relation<InquiryMessage[]>;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}
