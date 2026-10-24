"""Provider schemas. Unknown fields are retained only in provider data, never guessed."""
from pydantic import BaseModel, Field, ConfigDict


class DriverIdentity(BaseModel):
    driverId: str = Field(min_length=1)
    givenName: str
    familyName: str
    code: str | None = None
    dateOfBirth: str | None = None
    nationality: str | None = None


class ConstructorIdentity(BaseModel):
    constructorId: str = Field(min_length=1)
    name: str
    nationality: str | None = None


class Classification(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    Driver: DriverIdentity
    Constructor: ConstructorIdentity
    position: int | None = None
    positionText: str | None = None
    number: str | None = None
    points: float = 0
    grid: int | None = None
    laps: int | None = None
    status: str | None = None
    FastestLap: dict | None = None
    Q1: str | None = None
    Q2: str | None = None
    Q3: str | None = None


class Race(BaseModel):
    model_config = ConfigDict(extra="allow")
    season: int
    round: int = Field(ge=1)
    raceName: str
    date: str
    time: str | None = None
    Circuit: dict
    Results: list[Classification] = []
    SprintResults: list[Classification] = []
    QualifyingResults: list[Classification] = []


class Standing(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    position: int | None = None
    positionText: str | None = None
    points: float
    wins: int
    Driver: DriverIdentity | None = None
    Constructor: ConstructorIdentity | None = None
    Constructors: list[ConstructorIdentity] = []
