import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, BigInt } from "@graphprotocol/graph-ts"
import { APYUpdated } from "../generated/schema"
import { APYUpdated as APYUpdatedEvent } from "../generated/APYStorage/APYStorage"
import { handleAPYUpdated } from "../src/apy-storage"
import { createAPYUpdatedEvent } from "./apy-storage-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let pool = Address.fromString("0x0000000000000000000000000000000000000001")
    let apy = BigInt.fromI32(234)
    let timestamp = BigInt.fromI32(234)
    let newAPYUpdatedEvent = createAPYUpdatedEvent(pool, apy, timestamp)
    handleAPYUpdated(newAPYUpdatedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("APYUpdated created and stored", () => {
    assert.entityCount("APYUpdated", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "APYUpdated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "pool",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "APYUpdated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "apy",
      "234"
    )
    assert.fieldEquals(
      "APYUpdated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "timestamp",
      "234"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
