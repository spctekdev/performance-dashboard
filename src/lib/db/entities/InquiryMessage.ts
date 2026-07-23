import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from "typeorm";
import { Inquiry } from "./Inquiry";
import { User } from "./User";

@Entity("inquiry_messages")
@Index(["inquiryId", "createdAt"])
export class InquiryMessage {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) inquiryId!: string;
  @ManyToOne(() => Inquiry, (inquiry) => inquiry.messages, { onDelete: "CASCADE" })
  @JoinColumn({ name: "inquiryId" })
  inquiry!: Relation<Inquiry>;
  @Column({ type: "uuid" }) authorId!: string;
  @ManyToOne(() => User, { onDelete: "RESTRICT" }) @JoinColumn({ name: "authorId" }) author!: Relation<User>;
  @Column({ type: "text" }) body!: string;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
}
