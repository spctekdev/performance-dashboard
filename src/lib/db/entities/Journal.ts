import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";

export enum JournalCategory {
  GOOD = "GOOD",
  BAD = "BAD",
}

@Entity("journals")
@Index(["userId", "period"])
export class Journal {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) userId!: string;
  @ManyToOne(() => User, (user) => user.journals, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: Relation<User>;
  @Column({ type: "text" }) description!: string;
  @Column({ type: "enum", enum: JournalCategory }) category!: JournalCategory;
  @Column({ type: "numeric", precision: 8, scale: 2 }) impact!: string;
  @Column({ type: "date" }) period!: string;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}
